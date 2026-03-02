import * as http from 'http';
import * as ast from '../parser/ast.js';
import { Interpreter } from './interpreter.js';
import { Environment } from './environment.js';
import { LythraValue, RuntimeError, stringify, ReturnEx, HaltEx } from './types.js';

export class LythraServerManager {
  private servers: LythraServer[] = [];

  registerServer(name: string, port: number, declaration: ast.ServerDeclaration) {
    this.servers.push(new LythraServer(name, port, declaration));
  }

  async openDoors(mainInterpreter: Interpreter) {
    for (const server of this.servers) {
      await server.start(mainInterpreter);
    }
  }

  async stopServers() {
    for (const server of this.servers) {
      await server.stop();
    }
    this.servers = [];
  }
}

export class LythraServer {
  private httpServer: http.Server | null = null;
  private channels: ast.ChannelDeclaration[] = [];
  private filters: ast.FilterDeclaration[] = [];

  constructor(
    public readonly name: string,
    public readonly port: number,
    public readonly declaration: ast.ServerDeclaration
  ) {
    // Extract channels and filters from the server body
    for (const stmt of declaration.body.statements) {
      if (stmt.kind === 'ChannelDeclaration') {
        this.channels.push(stmt);
      } else if (stmt.kind === 'FilterDeclaration') {
        this.filters.push(stmt);
      }
    }
  }

  async start(mainInterpreter: Interpreter) {
    return new Promise<void>((resolve, reject) => {
      this.httpServer = http.createServer(async (req, res) => {
        try {
          // Find matching channel
          const url = req.url || '/';
          const method = req.method || 'GET';

          let matchedChannel: ast.ChannelDeclaration | null = null;
          // Simple exact match for now
          for (const channel of this.channels) {
            if (channel.path === url) {
              matchedChannel = channel;
              break;
            }
          }

          if (!matchedChannel) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
          }

          let matchedHandler: ast.MethodHandler | null = null;
          for (const stmt of matchedChannel.body.statements) {
            if (stmt.kind === 'MethodHandler' && stmt.method === method) {
              matchedHandler = stmt;
              break;
            }
          }

          if (!matchedHandler) {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed');
            return;
          }

          // Create a new request-scoped interpreter
          const requestInterpreter = new Interpreter();
          // Share global definitions (methods, variables)
          requestInterpreter.globals = mainInterpreter.globals;

          const requestEnv = new Environment(mainInterpreter.globals); // create a top level scope explicitly for this request so it doesn't pollute globals

          // Inject hidden native HTTP objects into environment
          requestEnv.defineInternal('__req', req);
          requestEnv.defineInternal('__res', res);

          try {
            await requestInterpreter.executeBlock(matchedHandler.body.statements, requestEnv);
            // If the handler completes without calling transmit, end it safely
            if (!res.writableEnded) {
              res.end();
            }
          } catch (e: any) {
            if (e instanceof ReturnEx || e instanceof HaltEx) {
              if (!res.writableEnded) res.end();
              return;
            }
            console.error(`Runtime Error in Server ${this.name}:`, e.message);
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('Internal Server Error');
            }
          }
        } catch (unhandled) {
          console.error(`Unhandled Web Server Ex:`, unhandled);
        }
      });

      this.httpServer.listen(this.port, () => {
        console.log(`[Lythra] Server ${this.name} securely opened doors on port ${this.port}`);
        resolve();
      });

      this.httpServer.on('error', (err) => {
        console.error(`Server failed to start on port ${this.port}`);
        reject(err);
      });
    });
  }

  async stop() {
    return new Promise<void>((resolve) => {
      if (this.httpServer) {
        this.httpServer.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

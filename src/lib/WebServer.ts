import { env } from '$/types/env';
import express, { Express, Request, Response, NextFunction } from 'express';
import type { Server } from 'node:http';
import Logger from './logger';
import { parseLang, renderIndex, renderPrivacy, renderTerms } from './web/pages';

const l = new Logger('WebServer', 'blue');

export class WebServer {
    public app: Express;
    private server: Server | null = null;

    constructor() {
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware() {
        this.app.disable('x-powered-by');

        // Basic security headers
        this.app.use((_req: Request, res: Response, next: NextFunction) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
            next();
        });
    }

    private setupRoutes() {
        // Landing page
        this.app.get('/', (_req: Request, res: Response) => {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(renderIndex());
        });

        // Terms of Service
        const handleTerms = (req: Request, res: Response) => {
            const lang = parseLang(req.query.lang);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(renderTerms(lang));
        };
        this.app.get('/terms', handleTerms);
        this.app.get('/tos', handleTerms);
        this.app.get('/podminky', handleTerms);

        // Privacy Policy
        const handlePrivacy = (req: Request, res: Response) => {
            const lang = parseLang(req.query.lang);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(renderPrivacy(lang));
        };
        this.app.get('/privacy', handlePrivacy);
        this.app.get('/zasady', handlePrivacy);

        // Health check
        this.app.get('/health', (_req: Request, res: Response) => {
            res.json({ status: 'ok' });
        });
    }

    public async start(): Promise<Server> {
        if (this.server) {
            return this.server;
        }

        const host = env.WEBSERVER_HOST;
        const port = env.WEBSERVER_PORT;
        l.start(`Starting WebServer on ${host}:${port}...`);

        return new Promise((resolve) => {
            this.server = this.app.listen(port, host, () => {
                l.stop(`WebServer listening on ${host}:${port}`);
                resolve(this.server!);
            });
        });
    }

    public async stop(): Promise<void> {
        if (!this.server) return;

        return new Promise((resolve, reject) => {
            this.server!.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    this.server = null;
                    resolve();
                }
            });
        });
    }
}

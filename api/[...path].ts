import express from 'express';
import { apiRouter } from '../server/routes';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api', apiRouter);

export const config = {
  maxDuration: 60,
};

export default app;

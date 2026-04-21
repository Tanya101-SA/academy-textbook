import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { topicsRouter } from './routes/topics.js';
import { mappingsRouter } from './routes/mappings.js';
import { publishersRouter } from './routes/publishers.js';
import { statsRouter } from './routes/stats.js';
import { textbooksRouter } from './routes/textbooks.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/topics', topicsRouter);
app.use('/api/mappings', mappingsRouter);
app.use('/api/publishers', publishersRouter);
app.use('/api/stats', statsRouter);
app.use('/api/textbooks', textbooksRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

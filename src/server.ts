import express, { Request, Response, NextFunction } from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import dotenv from 'dotenv';
import { Anthropic } from '@anthropic-ai/sdk';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize SQLite database
const db = new sqlite3.Database(':memory:');
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// DATABASE SCHEMA
// ============================================================================

function initializeDatabase() {
  db.serialize(() => {
    // Projects table
    db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        project_type TEXT DEFAULT 'standard',
        start_date TEXT,
        due_date TEXT,
        completed_date TEXT,
        color_tag TEXT DEFAULT 'gray',
        default_priority INTEGER DEFAULT 3,
        include_in_ai_sorting BOOLEAN DEFAULT 1,
        auto_archive_on_completion BOOLEAN DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tasks table
    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        project_id TEXT,
        category TEXT,
        task_type TEXT,
        urgency INTEGER,
        importance INTEGER,
        estimated_duration REAL,
        optimal_time TEXT,
        is_background_task BOOLEAN DEFAULT 0,
        ai_suitable BOOLEAN DEFAULT 0,
        status TEXT DEFAULT 'dump',
        source_file_url TEXT,
        original_text TEXT,
        normalized_text TEXT,
        is_duplicate BOOLEAN DEFAULT 0,
        duplicate_of_task_id TEXT,
        duplicate_confidence REAL,
        version INTEGER DEFAULT 1,
        parent_task_id TEXT,
        completed_date TEXT,
        scheduled_start TEXT,
        scheduled_end TEXT,
        is_scheduled BOOLEAN DEFAULT 0,
        ai_confidence_score REAL,
        google_calendar_event_id TEXT,
        needs_clarification BOOLEAN DEFAULT 0,
        clarification_notes TEXT,
        uncertain_elements TEXT,
        context_tags TEXT,
        ai_processing_confidence REAL,
        ai_detected_type TEXT,
        ai_extracted_keywords TEXT,
        ai_assumptions TEXT,
        missing_information TEXT,
        next_action_suggestions TEXT,
        input_quality_score REAL,
        normalization_applied BOOLEAN DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (parent_task_id) REFERENCES tasks(id)
      )
    `);

    // User preferences table
    db.run(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id TEXT PRIMARY KEY,
        work_hours_start TEXT DEFAULT '09:00',
        work_hours_end TEXT DEFAULT '17:00',
        work_days TEXT DEFAULT '[1,2,3,4,5]',
        break_duration REAL DEFAULT 1,
        break_start_time TEXT DEFAULT '12:00',
        buffer_between_tasks REAL DEFAULT 0.25,
        calendar_sync_enabled BOOLEAN DEFAULT 0,
        preferred_calendar_service TEXT DEFAULT 'none',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Calendar events table
    db.run(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        event_type TEXT DEFAULT 'other',
        location TEXT,
        attendees TEXT,
        is_all_day BOOLEAN DEFAULT 0,
        reminder_minutes INTEGER,
        recurring TEXT DEFAULT 'none',
        google_event_id TEXT,
        outlook_event_id TEXT,
        icloud_event_id TEXT,
        sync_status TEXT DEFAULT 'local_only',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function dbRun(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// ============================================================================
// AI PROCESSING ENGINE
// ============================================================================

interface AITaskAnalysis {
  detected_type: string;
  extracted_keywords: string[];
  assumptions: string;
  missing_information: string[];
  next_action_suggestions: string[];
  needs_clarification: boolean;
  clarification_notes: string;
  uncertain_elements: string[];
  input_quality_score: number;
  processing_confidence: number;
}

async function analyzeTaskWithAI(taskText: string): Promise<AITaskAnalysis> {
  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Analyze this task description and provide structured insights. Return ONLY valid JSON.

Task: "${taskText}"

Analyze and return this exact JSON structure:
{
  "detected_type": "phone_call|admin_task|field_task|clean_up|travel_out|unknown",
  "extracted_keywords": ["keyword1", "keyword2"],
  "assumptions": "What you assumed about this task",
  "missing_information": ["what_date", "what_priority"],
  "next_action_suggestions": ["First step", "Second step"],
  "needs_clarification": true/false,
  "clarification_notes": "Questions for the user",
  "uncertain_elements": ["vague part 1", "unclear part 2"],
  "input_quality_score": 0.8,
  "processing_confidence": 0.95
}`,
      },
    ],
  });

  try {
    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '{}';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {
      detected_type: 'unknown',
      extracted_keywords: [],
      assumptions: 'Could not analyze',
      missing_information: [],
      next_action_suggestions: [],
      needs_clarification: true,
      clarification_notes: 'Task description unclear',
      uncertain_elements: [taskText],
      input_quality_score: 0.3,
      processing_confidence: 0.2,
    };
  }
}

async function detectDuplicates(taskTitle: string, existingTasks: any[]): Promise<{ isDuplicate: boolean; confidence: number; duplicateOf?: string }> {
  if (existingTasks.length === 0) {
    return { isDuplicate: false, confidence: 0 };
  }

  const taskList = existingTasks
    .slice(0, 10)
    .map((t: any) => `- ${t.title}`)
    .join('\n');

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: `Is this task a duplicate? Return ONLY: {"isDuplicate": true/false, "confidence": 0.0-1.0, "duplicateOf": "task title or null"}

New task: "${taskTitle}"

Similar existing tasks:
${taskList}`,
      },
    ],
  });

  try {
    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '{}';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    return JSON.parse(jsonMatch[0]);
  } catch {
    return { isDuplicate: false, confidence: 0 };
  }
}

// ============================================================================
// API ENDPOINTS - TASKS
// ============================================================================

// Create task
app.post('/api/tasks', async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      project_id,
      category,
      task_type,
      urgency,
      importance,
      estimated_duration,
      optimal_time,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title required' });
    }

    const id = generateId();
    const originalText = `${title}. ${description || ''}`.trim();

    // AI analysis
    const aiAnalysis = await analyzeTaskWithAI(originalText);

    // Duplicate detection
    const existingTasks = await dbAll('SELECT id, title FROM tasks WHERE status != ?', [
      'archived',
    ]);
    const dupCheck = await detectDuplicates(title, existingTasks);

    const taskData = {
      id,
      title,
      description,
      project_id,
      category: category || 'personal',
      task_type: task_type || aiAnalysis.detected_type,
      urgency,
      importance,
      estimated_duration,
      optimal_time: optimal_time || 'anytime',
      status: 'dump',
      original_text: originalText,
      normalized_text: title,
      ai_detected_type: aiAnalysis.detected_type,
      ai_extracted_keywords: JSON.stringify(aiAnalysis.extracted_keywords),
      ai_assumptions: aiAnalysis.assumptions,
      missing_information: JSON.stringify(aiAnalysis.missing_information),
      next_action_suggestions: JSON.stringify(aiAnalysis.next_action_suggestions),
      needs_clarification: aiAnalysis.needs_clarification ? 1 : 0,
      clarification_notes: aiAnalysis.clarification_notes,
      uncertain_elements: JSON.stringify(aiAnalysis.uncertain_elements),
      ai_processing_confidence: aiAnalysis.processing_confidence,
      input_quality_score: aiAnalysis.input_quality_score,
      is_duplicate: dupCheck.isDuplicate ? 1 : 0,
      duplicate_of_task_id: dupCheck.duplicateOf || null,
      duplicate_confidence: dupCheck.confidence,
      ai_suitable: 1,
    };

    await dbRun(
      `INSERT INTO tasks (${Object.keys(taskData).join(', ')}) 
       VALUES (${Object.keys(taskData)
         .map(() => '?')
         .join(', ')})`,
      Object.values(taskData)
    );

    res.status(201).json({ id, ...taskData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Get all tasks
app.get('/api/tasks', async (req: Request, res: Response) => {
  try {
    const { status, category, project_id, limit = 50, offset = 0 } = req.query;

    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params: any[] = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (project_id) {
      sql += ' AND project_id = ?';
      params.push(project_id);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const tasks = await dbAll(sql, params);

    // Parse JSON fields
    const parsedTasks = tasks.map((t: any) => ({
      ...t,
      ai_extracted_keywords: t.ai_extracted_keywords ? JSON.parse(t.ai_extracted_keywords) : [],
      missing_information: t.missing_information ? JSON.parse(t.missing_information) : [],
      next_action_suggestions: t.next_action_suggestions ? JSON.parse(t.next_action_suggestions) : [],
      uncertain_elements: t.uncertain_elements ? JSON.parse(t.uncertain_elements) : [],
    }));

    res.json(parsedTasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get single task
app.get('/api/tasks/:id', async (req: Request, res: Response) => {
  try {
    const task = await dbGet('SELECT * FROM tasks WHERE id = ?', [req.params.id]);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({
      ...task,
      ai_extracted_keywords: task.ai_extracted_keywords
        ? JSON.parse(task.ai_extracted_keywords)
        : [],
      missing_information: task.missing_information
        ? JSON.parse(task.missing_information)
        : [],
      next_action_suggestions: task.next_action_suggestions
        ? JSON.parse(task.next_action_suggestions)
        : [],
      uncertain_elements: task.uncertain_elements ? JSON.parse(task.uncertain_elements) : [],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Update task
app.put('/api/tasks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const setClause = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(', ');
    const values = [...Object.values(updates), id];

    await dbRun(`UPDATE tasks SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);

    const updatedTask = await dbGet('SELECT * FROM tasks WHERE id = ?', [id]);
    res.json(updatedTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task
app.delete('/api/tasks/:id', async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ============================================================================
// API ENDPOINTS - PROJECTS
// ============================================================================

// Create project
app.post('/api/projects', async (req: Request, res: Response) => {
  try {
    const { name, description, project_type = 'standard', status = 'active' } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name required' });
    }

    const id = generateId();

    await dbRun(
      `INSERT INTO projects (id, name, description, project_type, status) 
       VALUES (?, ?, ?, ?, ?)`,
      [id, name, description, project_type, status]
    );

    const project = await dbGet('SELECT * FROM projects WHERE id = ?', [id]);
    res.status(201).json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Get all projects
app.get('/api/projects', async (req: Request, res: Response) => {
  try {
    const projects = await dbAll('SELECT * FROM projects ORDER BY created_at DESC');
    res.json(projects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project
app.get('/api/projects/:id', async (req: Request, res: Response) => {
  try {
    const project = await dbGet('SELECT * FROM projects WHERE id = ?', [req.params.id]);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Update project
app.put('/api/projects/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const setClause = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(', ');
    const values = [...Object.values(updates), id];

    await dbRun(
      `UPDATE projects SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    const updatedProject = await dbGet('SELECT * FROM projects WHERE id = ?', [id]);
    res.json(updatedProject);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
app.delete('/api/projects/:id', async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM projects WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ============================================================================
// API ENDPOINTS - USER PREFERENCES
// ============================================================================

// Get preferences
app.get('/api/user/preferences', async (req: Request, res: Response) => {
  try {
    let prefs = await dbGet('SELECT * FROM user_preferences LIMIT 1');

    if (!prefs) {
      const id = generateId();
      await dbRun(
        `INSERT INTO user_preferences (id) VALUES (?)`,
        [id]
      );
      prefs = await dbGet('SELECT * FROM user_preferences WHERE id = ?', [id]);
    }

    res.json(prefs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// Update preferences
app.put('/api/user/preferences', async (req: Request, res: Response) => {
  try {
    const updates = req.body;

    // Get or create preferences
    let prefs = await dbGet('SELECT id FROM user_preferences LIMIT 1');
    if (!prefs) {
      const id = generateId();
      await dbRun(`INSERT INTO user_preferences (id) VALUES (?)`, [id]);
      prefs = await dbGet('SELECT id FROM user_preferences WHERE id = ?', [id]);
    }

    const setClause = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(', ');
    const values = [...Object.values(updates), prefs.id];

    await dbRun(
      `UPDATE user_preferences SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    const updatedPrefs = await dbGet('SELECT * FROM user_preferences WHERE id = ?', [prefs.id]);
    res.json(updatedPrefs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// ============================================================================
// API ENDPOINTS - CALENDAR EVENTS
// ============================================================================

// Create calendar event
app.post('/api/calendar/events', async (req: Request, res: Response) => {
  try {
    const { title, start_time, end_time, description, event_type, location } = req.body;

    if (!title || !start_time || !end_time) {
      return res.status(400).json({ error: 'Title, start_time, and end_time required' });
    }

    const id = generateId();

    await dbRun(
      `INSERT INTO calendar_events (id, title, description, start_time, end_time, event_type, location) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, title, description, start_time, end_time, event_type || 'other', location]
    );

    const event = await dbGet('SELECT * FROM calendar_events WHERE id = ?', [id]);
    res.status(201).json(event);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Get calendar events
app.get('/api/calendar/events', async (req: Request, res: Response) => {
  try {
    const events = await dbAll('SELECT * FROM calendar_events ORDER BY start_time DESC');
    res.json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.PORT || 3001;

initializeDatabase();

app.listen(PORT, () => {
  console.log(`🚀 FlowTask AI API running on http://localhost:${PORT}`);
});

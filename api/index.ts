import { VercelRequest, VercelResponse } from '@vercel/node';
import sqlite3 from 'sqlite3';
import { Anthropic } from '@anthropic-ai/sdk';

// Initialize database (uses in-memory for Vercel - no persistence between cold starts)
const db = new sqlite3.Database(':memory:');
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize DB on first request
let dbInitialized = false;

function initializeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (dbInitialized) {
      resolve();
      return;
    }

    db.serialize(() => {
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
      `, (err) => {
        dbInitialized = true;
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

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

async function analyzeTaskWithAI(taskText: string) {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Analyze this task and return ONLY valid JSON:

Task: "${taskText}"

Return this exact structure:
{
  "detected_type": "phone_call|admin_task|field_task|clean_up|travel_out|unknown",
  "extracted_keywords": ["keyword1", "keyword2"],
  "assumptions": "What you assumed",
  "missing_information": ["field1", "field2"],
  "next_action_suggestions": ["Step 1", "Step 2"],
  "needs_clarification": false,
  "clarification_notes": "",
  "uncertain_elements": [],
  "input_quality_score": 0.8,
  "processing_confidence": 0.9
}`,
        },
      ],
    });

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '{}';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('AI analysis error:', error);
    return {
      detected_type: 'unknown',
      extracted_keywords: [],
      assumptions: 'Analysis failed',
      missing_information: [],
      next_action_suggestions: [],
      needs_clarification: true,
      clarification_notes: 'Unable to analyze',
      uncertain_elements: [taskText],
      input_quality_score: 0.3,
      processing_confidence: 0.1,
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,OPTIONS,PATCH,DELETE,POST,PUT'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    await initializeDatabase();

    const { pathname, searchParams } = new URL(req.url || '', 'http://localhost');
    const method = req.method || 'GET';

    // Health check
    if (pathname === '/api/health') {
      return res.status(200).json({ status: 'ok' });
    }

    // ==================== TASKS ====================

    // POST /api/tasks
    if (pathname === '/api/tasks' && method === 'POST') {
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

      const aiAnalysis = await analyzeTaskWithAI(originalText);

      const existingTasks = await dbAll(
        'SELECT id, title FROM tasks WHERE status != ?',
        ['archived']
      );

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
        next_action_suggestions: JSON.stringify(
          aiAnalysis.next_action_suggestions
        ),
        needs_clarification: aiAnalysis.needs_clarification ? 1 : 0,
        clarification_notes: aiAnalysis.clarification_notes,
        uncertain_elements: JSON.stringify(aiAnalysis.uncertain_elements),
        ai_processing_confidence: aiAnalysis.processing_confidence,
        input_quality_score: aiAnalysis.input_quality_score,
        ai_suitable: 1,
      };

      await dbRun(
        `INSERT INTO tasks (${Object.keys(taskData).join(', ')}) 
         VALUES (${Object.keys(taskData)
           .map(() => '?')
           .join(', ')})`,
        Object.values(taskData)
      );

      return res.status(201).json({ id, ...taskData });
    }

    // GET /api/tasks
    if (pathname === '/api/tasks' && method === 'GET') {
      const status = searchParams.get('status');
      const category = searchParams.get('category');
      const project_id = searchParams.get('project_id');
      const limit = parseInt(searchParams.get('limit') || '50');
      const offset = parseInt(searchParams.get('offset') || '0');

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

      const parsedTasks = tasks.map((t: any) => ({
        ...t,
        ai_extracted_keywords: t.ai_extracted_keywords
          ? JSON.parse(t.ai_extracted_keywords)
          : [],
        missing_information: t.missing_information
          ? JSON.parse(t.missing_information)
          : [],
        next_action_suggestions: t.next_action_suggestions
          ? JSON.parse(t.next_action_suggestions)
          : [],
        uncertain_elements: t.uncertain_elements
          ? JSON.parse(t.uncertain_elements)
          : [],
      }));

      return res.status(200).json(parsedTasks);
    }

    // GET /api/tasks/:id
    if (pathname.match(/^\/api\/tasks\/[^/]+$/) && method === 'GET') {
      const id = pathname.split('/').pop();
      const task = await dbGet('SELECT * FROM tasks WHERE id = ?', [id]);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      return res.status(200).json({
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
        uncertain_elements: task.uncertain_elements
          ? JSON.parse(task.uncertain_elements)
          : [],
      });
    }

    // PUT /api/tasks/:id
    if (pathname.match(/^\/api\/tasks\/[^/]+$/) && method === 'PUT') {
      const id = pathname.split('/').pop();
      const updates = req.body;

      const setClause = Object.keys(updates)
        .map((key) => `${key} = ?`)
        .join(', ');
      const values = [...Object.values(updates), id];

      await dbRun(
        `UPDATE tasks SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );

      const updatedTask = await dbGet('SELECT * FROM tasks WHERE id = ?', [id]);
      return res.status(200).json(updatedTask);
    }

    // DELETE /api/tasks/:id
    if (pathname.match(/^\/api\/tasks\/[^/]+$/) && method === 'DELETE') {
      const id = pathname.split('/').pop();
      await dbRun('DELETE FROM tasks WHERE id = ?', [id]);
      return res.status(200).json({ success: true });
    }

    // ==================== PROJECTS ====================

    // POST /api/projects
    if (pathname === '/api/projects' && method === 'POST') {
      const { name, description, project_type = 'standard', status = 'active' } =
        req.body;

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
      return res.status(201).json(project);
    }

    // GET /api/projects
    if (pathname === '/api/projects' && method === 'GET') {
      const projects = await dbAll(
        'SELECT * FROM projects ORDER BY created_at DESC'
      );
      return res.status(200).json(projects);
    }

    // GET /api/projects/:id
    if (pathname.match(/^\/api\/projects\/[^/]+$/) && method === 'GET') {
      const id = pathname.split('/').pop();
      const project = await dbGet('SELECT * FROM projects WHERE id = ?', [id]);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      return res.status(200).json(project);
    }

    // PUT /api/projects/:id
    if (pathname.match(/^\/api\/projects\/[^/]+$/) && method === 'PUT') {
      const id = pathname.split('/').pop();
      const updates = req.body;

      const setClause = Object.keys(updates)
        .map((key) => `${key} = ?`)
        .join(', ');
      const values = [...Object.values(updates), id];

      await dbRun(
        `UPDATE projects SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );

      const updatedProject = await dbGet('SELECT * FROM projects WHERE id = ?', [
        id,
      ]);
      return res.status(200).json(updatedProject);
    }

    // DELETE /api/projects/:id
    if (pathname.match(/^\/api\/projects\/[^/]+$/) && method === 'DELETE') {
      const id = pathname.split('/').pop();
      await dbRun('DELETE FROM projects WHERE id = ?', [id]);
      return res.status(200).json({ success: true });
    }

    // ==================== USER PREFERENCES ====================

    // GET /api/user/preferences
    if (pathname === '/api/user/preferences' && method === 'GET') {
      let prefs = await dbGet('SELECT * FROM user_preferences LIMIT 1');

      if (!prefs) {
        const id = generateId();
        await dbRun(`INSERT INTO user_preferences (id) VALUES (?)`, [id]);
        prefs = await dbGet('SELECT * FROM user_preferences WHERE id = ?', [id]);
      }

      return res.status(200).json(prefs);
    }

    // PUT /api/user/preferences
    if (pathname === '/api/user/preferences' && method === 'PUT') {
      const updates = req.body;

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

      const updatedPrefs = await dbGet('SELECT * FROM user_preferences WHERE id = ?', [
        prefs.id,
      ]);
      return res.status(200).json(updatedPrefs);
    }

    // ==================== CALENDAR ====================

    // POST /api/calendar/events
    if (pathname === '/api/calendar/events' && method === 'POST') {
      const { title, start_time, end_time, description, event_type, location } =
        req.body;

      if (!title || !start_time || !end_time) {
        return res
          .status(400)
          .json({ error: 'Title, start_time, and end_time required' });
      }

      const id = generateId();

      await dbRun(
        `INSERT INTO calendar_events (id, title, description, start_time, end_time, event_type, location) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, title, description, start_time, end_time, event_type || 'other', location]
      );

      const event = await dbGet('SELECT * FROM calendar_events WHERE id = ?', [id]);
      return res.status(201).json(event);
    }

    // GET /api/calendar/events
    if (pathname === '/api/calendar/events' && method === 'GET') {
      const events = await dbAll(
        'SELECT * FROM calendar_events ORDER BY start_time DESC'
      );
      return res.status(200).json(events);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

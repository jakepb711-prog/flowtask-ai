# FlowTask AI - Local Rebuild

Complete local rebuild of the Base44 FlowTask AI app with full backend, AI engine, and React frontend.

## ⚡ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# 3. Run dev server (backend + frontend)
npm run dev
```

Server: `http://localhost:3001`  
Frontend: `http://localhost:5173` (Vite)

---

## 📁 PROJECT STRUCTURE

```
flowtask-ai/
├── src/
│   ├── server.ts          # Express backend with all APIs
│   ├── client/            # React frontend (create separately)
│   └── types.ts           # TypeScript interfaces
├── package.json           # Dependencies
├── tsconfig.json         # TypeScript config
├── .env.example          # Environment template
└── README.md
```

---

## 🔧 BACKEND API ENDPOINTS

### Tasks
```
POST   /api/tasks              # Create task (with AI analysis)
GET    /api/tasks              # List tasks (filters: status, category, project_id)
GET    /api/tasks/:id          # Get single task
PUT    /api/tasks/:id          # Update task
DELETE /api/tasks/:id          # Delete task
```

### Projects
```
POST   /api/projects           # Create project
GET    /api/projects           # List all projects
GET    /api/projects/:id       # Get project
PUT    /api/projects/:id       # Update project
DELETE /api/projects/:id       # Delete project
```

### User Preferences
```
GET    /api/user/preferences   # Get settings
PUT    /api/user/preferences   # Update settings
```

### Calendar
```
POST   /api/calendar/events    # Create event
GET    /api/calendar/events    # List events
```

---

## 🤖 AI FEATURES INCLUDED

### Task Analysis
- **Auto Task Classification:** Detects task type (phone_call, admin_task, field_task, etc.)
- **Keyword Extraction:** Identifies important terms
- **Clarification Detection:** Flags vague/ambiguous tasks
- **Missing Info Detection:** Identifies gaps in task description
- **Next Action Suggestions:** AI generates first steps
- **Input Quality Scoring:** Rates clarity of original text
- **Processing Confidence:** Confidence metric on AI interpretation

### Duplicate Detection
- Compares new tasks against existing ones
- Returns confidence score and which task it matches
- Prevents task duplication

---

## 📊 DATABASE SCHEMA

### Tasks
Complete task management with 40+ fields:
- Core: title, description, category, task_type
- Priority: urgency (1-5), importance (1-5)
- Scheduling: scheduled_start, scheduled_end, optimal_time
- AI Data: ai_confidence_score, ai_detected_type, clarification_notes
- Duplicate Tracking: is_duplicate, duplicate_of_task_id, duplicate_confidence
- Status Workflow: dump → active → completed/archived/junkyard

### Projects
- name, description, status, project_type
- Color tags, priority defaults
- Auto-archive on completion option

### User Preferences
- Work hours (start/end), work days
- Break duration, buffer between tasks
- Calendar service preference

### Calendar Events
- title, start_time, end_time, event_type
- Recurring patterns, attendees
- External calendar sync IDs (Google, Outlook, iCloud)

---

## 🚀 DEPLOYMENT

### Option 1: Local Development
```bash
npm run dev
```

### Option 2: Production Build
```bash
npm run server:build
npm run server:start
```

### Option 3: Docker
Create `Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

Build and run:
```bash
docker build -t flowtask-ai .
docker run -p 3001:3001 -e ANTHROPIC_API_KEY=sk_xxx flowtask-ai
```

### Option 4: Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

Configure `vercel.json`:
```json
{
  "buildCommand": "npm run server:build",
  "outputDirectory": "dist",
  "env": ["ANTHROPIC_API_KEY"]
}
```

---

## 🔐 ENVIRONMENT VARIABLES

```
ANTHROPIC_API_KEY=sk_your_key_here    # Required - Get from https://console.anthropic.com
PORT=3001                             # Optional - Server port
NODE_ENV=development                  # Optional - dev/production
```

---

## 📝 API EXAMPLES

### Create Task
```bash
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Call Dr. Smith about patient intake",
    "description": "Follow up on Sarah Jones case",
    "category": "case_work",
    "urgency": 4,
    "importance": 5
  }'
```

Returns:
```json
{
  "id": "abc123",
  "title": "Call Dr. Smith about patient intake",
  "task_type": "phone_call",
  "ai_confidence_score": 0.95,
  "ai_detected_type": "phone_call",
  "ai_extracted_keywords": ["call", "Dr. Smith", "patient intake"],
  "needs_clarification": false,
  "status": "dump",
  "created_at": "2026-06-17T..."
}
```

### Get Tasks by Status
```bash
curl "http://localhost:3001/api/tasks?status=active&limit=10"
```

### Update Task Status
```bash
curl -X PUT http://localhost:3001/api/tasks/abc123 \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'
```

---

## 📱 FRONTEND (React)

Create `src/client/App.tsx`:

```typescript
import { useEffect, useState } from 'react';
import axios from 'axios';

interface Task {
  id: string;
  title: string;
  status: string;
  urgency: number;
  importance: number;
  ai_confidence_score: number;
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/tasks?status=active');
      setTasks(response.data);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:3001/api/tasks', {
        title: newTaskTitle,
        category: 'personal',
        urgency: 3,
        importance: 3,
      });
      setTasks([response.data, ...tasks]);
      setNewTaskTitle('');
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      await axios.put(`http://localhost:3001/api/tasks/${taskId}`, {
        status: newStatus,
      });
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>FlowTask AI</h1>
      
      <form onSubmit={createTask} style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="Add new task..."
          style={{ width: '100%', padding: '10px', fontSize: '16px' }}
        />
        <button type="submit" style={{ marginTop: '10px', padding: '10px 20px' }}>
          Add Task
        </button>
      </form>

      <div>
        <h2>Active Tasks ({tasks.length})</h2>
        {tasks.map((task) => (
          <div
            key={task.id}
            style={{
              border: '1px solid #ccc',
              padding: '15px',
              marginBottom: '10px',
              borderRadius: '4px',
              backgroundColor: task.urgency > 3 ? '#fff3cd' : '#f8f9fa',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0' }}>{task.title}</h3>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  Urgency: {task.urgency}/5 | Importance: {task.importance}/5
                  {task.ai_confidence_score && (
                    <span> | AI Confidence: {(task.ai_confidence_score * 100).toFixed(0)}%</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => updateTaskStatus(task.id, 'completed')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Complete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

Create `src/client/main.tsx`:
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

Create `index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FlowTask AI</title>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/src/client/main.tsx"></script>
</body>
</html>
```

---

## ⚙️ CONFIGURATION

### vite.config.ts
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
```

---

## 🧪 TESTING

```bash
# Test backend
curl http://localhost:3001/health

# Create test task
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Test task"}'
```

---

## 🐛 TROUBLESHOOTING

**AI responses slow?**
- Check ANTHROPIC_API_KEY is valid
- Model inference takes ~1-2 seconds per request

**Database errors?**
- SQLite is in-memory by default
- Data resets on server restart
- Add SQLite persistence: `new sqlite3.Database('./flowtask.db')`

**Port already in use?**
- Change PORT in .env
- Or kill process: `lsof -ti:3001 | xargs kill -9`

---

## 📚 ADDITIONAL RESOURCES

- [Claude API Docs](https://docs.anthropic.com)
- [Express.js Guide](https://expressjs.com)
- [React Docs](https://react.dev)
- [SQLite Documentation](https://www.sqlite.org)

---

## 📄 LICENSE

MIT

import { useEffect, useState } from 'react'
import axios from 'axios'
import TaskDashboard from './components/TaskDashboard'
import TaskForm from './components/TaskForm'
import ProjectManager from './components/ProjectManager'
import './App.css'

interface Task {
  id: string
  title: string
  description?: string
  status: string
  urgency?: number
  importance?: number
  category?: string
  task_type?: string
  ai_confidence_score?: number
  ai_detected_type?: string
  needs_clarification?: boolean
  created_at?: string
}

interface Project {
  id: string
  name: string
  description?: string
  status: string
  color_tag?: string
  created_at?: string
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [activeTab, setActiveTab] = useState<'tasks' | 'projects' | 'settings'>('tasks')
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const API_URL = import.meta.env.PROD ? '' : 'http://localhost:3001'

  useEffect(() => {
    fetchTasks()
    fetchProjects()
  }, [])

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const status = filter === 'all' ? '' : `?status=${filter}`
      const response = await axios.get(`${API_URL}/api/tasks${status}`)
      setTasks(response.data)
      setError(null)
    } catch (err) {
      setError('Failed to fetch tasks')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchProjects = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/projects`)
      setProjects(response.data)
    } catch (err) {
      console.error('Failed to fetch projects:', err)
    }
  }

  const handleCreateTask = async (taskData: any) => {
    try {
      const response = await axios.post(`${API_URL}/api/tasks`, taskData)
      setTasks([response.data, ...tasks])
      setError(null)
    } catch (err) {
      setError('Failed to create task')
      console.error(err)
    }
  }

  const handleUpdateTask = async (taskId: string, updates: any) => {
    try {
      const response = await axios.put(`${API_URL}/api/tasks/${taskId}`, updates)
      setTasks(tasks.map(t => t.id === taskId ? response.data : t))
      setError(null)
    } catch (err) {
      setError('Failed to update task')
      console.error(err)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    try {
      await axios.delete(`${API_URL}/api/tasks/${taskId}`)
      setTasks(tasks.filter(t => t.id !== taskId))
      setError(null)
    } catch (err) {
      setError('Failed to delete task')
      console.error(err)
    }
  }

  const handleCreateProject = async (projectData: any) => {
    try {
      const response = await axios.post(`${API_URL}/api/projects`, projectData)
      setProjects([...projects, response.data])
      setError(null)
    } catch (err) {
      setError('Failed to create project')
      console.error(err)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>🚀 FlowTask AI</h1>
          <p>Intelligent task management with AI-powered analysis</p>
        </div>
      </header>

      <nav className="app-nav">
        <button
          className={`nav-btn ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Tasks
        </button>
        <button
          className={`nav-btn ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          Projects
        </button>
        <button
          className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </nav>

      <main className="app-main">
        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="tasks-view">
            <TaskForm onSubmit={handleCreateTask} projects={projects} />
            
            <div className="filter-bar">
              <button
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => { setFilter('all'); fetchTasks() }}
              >
                All
              </button>
              <button
                className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
                onClick={() => { setFilter('active'); fetchTasks() }}
              >
                Active
              </button>
              <button
                className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
                onClick={() => { setFilter('completed'); fetchTasks() }}
              >
                Completed
              </button>
            </div>

            <TaskDashboard
              tasks={tasks}
              loading={loading}
              onUpdate={handleUpdateTask}
              onDelete={handleDeleteTask}
            />
          </div>
        )}

        {activeTab === 'projects' && (
          <ProjectManager
            projects={projects}
            onCreateProject={handleCreateProject}
          />
        )}

        {activeTab === 'settings' && (
          <div className="settings-view">
            <h2>Settings</h2>
            <p>Settings panel coming soon...</p>
          </div>
        )}
      </main>
    </div>
  )
}

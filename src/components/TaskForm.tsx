import { useState } from 'react'

interface Project {
  id: string
  name: string
}

interface TaskFormProps {
  onSubmit: (taskData: any) => Promise<void>
  projects: Project[]
}

export default function TaskForm({ onSubmit, projects }: TaskFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('personal')
  const [projectId, setProjectId] = useState('')
  const [urgency, setUrgency] = useState(3)
  const [importance, setImportance] = useState(3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      setError('Title is required')
      return
    }

    try {
      setLoading(true)
      setError(null)

      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        category,
        project_id: projectId || null,
        urgency: parseInt(urgency.toString()),
        importance: parseInt(importance.toString()),
      })

      // Reset form
      setTitle('')
      setDescription('')
      setCategory('personal')
      setProjectId('')
      setUrgency(3)
      setImportance(3)
    } catch (err) {
      setError('Failed to create task')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="task-form-container">
      <h2>Add New Task</h2>
      <form onSubmit={handleSubmit} className="task-form">
        {error && <div className="form-error">{error}</div>}

        <div className="form-group">
          <label htmlFor="title">Title *</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter task title"
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add task details (optional)"
            rows={3}
            disabled={loading}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={loading}
            >
              <option value="personal">Personal</option>
              <option value="case_work">Case Work</option>
              <option value="rapid_response">Rapid Response</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="project">Project</label>
            <select
              id="project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={loading}
            >
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="urgency">
              Urgency: <span className="value-display">{urgency}</span>
            </label>
            <input
              id="urgency"
              type="range"
              min="1"
              max="5"
              value={urgency}
              onChange={(e) => setUrgency(parseInt(e.target.value))}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="importance">
              Importance: <span className="value-display">{importance}</span>
            </label>
            <input
              id="importance"
              type="range"
              min="1"
              max="5"
              value={importance}
              onChange={(e) => setImportance(parseInt(e.target.value))}
              disabled={loading}
            />
          </div>
        </div>

        <button
          type="submit"
          className="submit-btn"
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create Task'}
        </button>
      </form>
    </div>
  )
}

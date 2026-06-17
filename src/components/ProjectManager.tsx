import { useState } from 'react'

interface Project {
  id: string
  name: string
  description?: string
  status: string
  color_tag?: string
  created_at?: string
}

interface ProjectManagerProps {
  projects: Project[]
  onCreateProject: (projectData: any) => Promise<void>
}

export default function ProjectManager({
  projects,
  onCreateProject,
}: ProjectManagerProps) {
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDesc, setNewProjectDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newProjectName.trim()) {
      setError('Project name is required')
      return
    }

    try {
      setLoading(true)
      setError(null)

      await onCreateProject({
        name: newProjectName.trim(),
        description: newProjectDesc.trim(),
        status: 'active',
      })

      setNewProjectName('')
      setNewProjectDesc('')
    } catch (err) {
      setError('Failed to create project')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getColorStyle = (colorTag?: string) => {
    const colors: Record<string, string> = {
      gray: '#9e9e9e',
      red: '#f44336',
      orange: '#ff9800',
      yellow: '#fbc02d',
      green: '#4caf50',
      blue: '#2196f3',
      purple: '#9c27b0',
    }
    return colors[colorTag || 'gray']
  }

  return (
    <div className="projects-view">
      <h2>Projects</h2>

      <form onSubmit={handleCreateProject} className="project-form">
        {error && <div className="form-error">{error}</div>}

        <div className="form-group">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Project name"
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <textarea
            value={newProjectDesc}
            onChange={(e) => setNewProjectDesc(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            disabled={loading}
          />
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Creating...' : 'New Project'}
        </button>
      </form>

      <div className="projects-grid">
        {projects.map((project) => (
          <div
            key={project.id}
            className="project-card"
            style={{ borderTopColor: getColorStyle(project.color_tag) }}
          >
            <h3>{project.name}</h3>
            {project.description && <p>{project.description}</p>}
            <div className="project-meta">
              <span className="status">{project.status}</span>
              <span className="date">
                {new Date(project.created_at || '').toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="empty-state">No projects yet. Create one above!</div>
      )}
    </div>
  )
}

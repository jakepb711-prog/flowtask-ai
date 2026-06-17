import { useState } from 'react'

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

interface TaskDashboardProps {
  tasks: Task[]
  loading: boolean
  onUpdate: (taskId: string, updates: any) => Promise<void>
  onDelete: (taskId: string) => Promise<void>
}

export default function TaskDashboard({
  tasks,
  loading,
  onUpdate,
  onDelete,
}: TaskDashboardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const getUrgencyColor = (urgency?: number) => {
    if (!urgency) return '#999'
    if (urgency >= 4) return '#d32f2f'
    if (urgency >= 3) return '#f57c00'
    return '#388e3c'
  }

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      dump: '#9e9e9e',
      active: '#2196f3',
      completed: '#4caf50',
      archived: '#757575',
      junkyard: '#f44336',
    }
    return statusColors[status] || '#999'
  }

  if (loading) {
    return <div className="loading">Loading tasks...</div>
  }

  if (tasks.length === 0) {
    return <div className="empty-state">No tasks yet. Create one to get started!</div>
  }

  return (
    <div className="task-grid">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="task-card"
          style={{
            borderLeftColor: getUrgencyColor(task.urgency),
            backgroundColor:
              task.needs_clarification ? '#fff3e0' : task.status === 'completed' ? '#f1f8f5' : '#fff',
          }}
        >
          <div className="task-header">
            <div className="task-title-section">
              <h3>{task.title}</h3>
              <span
                className="status-badge"
                style={{ backgroundColor: getStatusBadge(task.status) }}
              >
                {task.status}
              </span>
            </div>
            <div className="task-actions">
              <button
                className="icon-btn"
                title="More options"
                onClick={() =>
                  setExpandedId(expandedId === task.id ? null : task.id)
                }
              >
                ⋮
              </button>
            </div>
          </div>

          {task.description && (
            <p className="task-description">{task.description}</p>
          )}

          <div className="task-meta">
            <div className="meta-item">
              <span className="label">Category:</span>
              <span>{task.category || 'personal'}</span>
            </div>
            {task.urgency && (
              <div className="meta-item">
                <span className="label">Urgency:</span>
                <span>
                  {'★'.repeat(task.urgency)}{'☆'.repeat(5 - task.urgency)}
                </span>
              </div>
            )}
            {task.importance && (
              <div className="meta-item">
                <span className="label">Importance:</span>
                <span>
                  {'★'.repeat(task.importance)}{'☆'.repeat(5 - task.importance)}
                </span>
              </div>
            )}
          </div>

          {task.ai_detected_type && (
            <div className="ai-info">
              <span className="ai-badge">🤖 {task.ai_detected_type}</span>
              {task.ai_confidence_score && (
                <span className="confidence">
                  {(task.ai_confidence_score * 100).toFixed(0)}% confidence
                </span>
              )}
            </div>
          )}

          {task.needs_clarification && (
            <div className="clarification-warning">
              ⚠️ This task needs clarification
            </div>
          )}

          {expandedId === task.id && (
            <div className="task-expanded">
              <button
                className="action-btn complete-btn"
                onClick={() =>
                  onUpdate(task.id, {
                    status: task.status === 'completed' ? 'active' : 'completed',
                  })
                }
              >
                {task.status === 'completed' ? 'Reopen' : 'Mark Complete'}
              </button>
              <button
                className="action-btn delete-btn"
                onClick={() => onDelete(task.id)}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import AdminLayout from '../../components/AdminLayout'

const INITIAL = {
  title: '', date: '', time: '',
  location: '', capacity: '',
  status: 'draft', description: '',
}

export default function CreateEvent() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [form, setForm] = useState(INITIAL)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const navigate = useNavigate()

  useEffect(() => {
    if (isEdit) {
      supabase.from('events').select('*').eq('id', id).single()
        .then(({ data }) => {
          if (data) {
            setForm({
              title: data.title || '',
              date: data.date || '',
              time: data.time || '',
              location: data.location || '',
              capacity: data.capacity || '',
              status: data.status || 'draft',
              description: data.description || '',
            })
          }
        })
    }
  }, [id])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setErrors({ ...errors, [e.target.name]: '' })
  }

  const validate = () => {
    const errs = {}
    if (!form.title.trim()) errs.title = 'Title is required'
    if (!form.date) errs.date = 'Date is required'
    if (!form.location.trim()) errs.location = 'Location is required'
    return errs
  }

  const handleSubmit = async () => {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)

    const payload = {
      title: form.title,
      date: form.date,
      time: form.time || null,
      location: form.location,
      capacity: form.capacity ? parseInt(form.capacity) : null,
      status: form.status,
      description: form.description,
    }

    if (isEdit) {
      await supabase.from('events').update(payload).eq('id', id)
    } else {
      await supabase.from('events').insert(payload)
    }

    setLoading(false)
    navigate('/manage-events')
  }

  const handleCancel = () => navigate('/manage-events')

  return (
    <AdminLayout>
      <div style={styles.page}>
        <div style={styles.header}>
          <h1 style={styles.title}>{isEdit ? 'Edit Event' : 'Create a new Event'}</h1>
          <p style={styles.sub}>Fill in the details to publish a new activity for SJC students.</p>
        </div>

        {/* General Info Section */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}><span>ℹ️</span> General Information</h2>
          <div style={styles.grid4}>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Title</label>
              <input style={{ ...styles.input, ...(errors.title ? styles.inputErr : {}) }}
                name="title" value={form.title} onChange={handleChange}
                placeholder="Event title" />
              {errors.title && <span style={styles.err}>{errors.title}</span>}
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Date</label>
              <input style={{ ...styles.input, ...(errors.date ? styles.inputErr : {}) }}
                type="date" name="date" value={form.date} onChange={handleChange} />
              {errors.date && <span style={styles.err}>{errors.date}</span>}
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Time</label>
              <input style={styles.input} type="time" name="time"
                value={form.time} onChange={handleChange} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Location</label>
              <input style={{ ...styles.input, ...(errors.location ? styles.inputErr : {}) }}
                name="location" value={form.location} onChange={handleChange}
                placeholder="Computer Laboratory 1" />
              {errors.location && <span style={styles.err}>{errors.location}</span>}
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Capacity</label>
              <input style={styles.input} type="number" name="capacity"
                value={form.capacity} onChange={handleChange} placeholder="45" />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Status</label>
              <select style={styles.input} name="status" value={form.status} onChange={handleChange}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Description Section */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}><span>📄</span> Description</h2>
          <textarea style={{ ...styles.input, ...styles.textarea }}
            name="description" value={form.description} onChange={handleChange}
            placeholder="Describe the event..." rows={5} />
        </div>

        {/* Actions */}
        <div style={styles.formActions}>
          <button style={styles.submitBtn} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Update Event' : 'Create Event'}
          </button>
          <button style={styles.cancelBtn} onClick={handleCancel}>Cancel</button>
        </div>
      </div>
    </AdminLayout>
  )
}

const styles = {
  page: { padding: '2rem', maxWidth: '900px' },
  header: { marginBottom: '1.5rem' },
  title: { fontSize: '1.75rem', fontWeight: 800 },
  sub: { color: 'var(--gray-500)', fontSize: '0.875rem', marginTop: '4px' },
  section: {
    background: 'var(--white)', border: '1px solid var(--gray-200)',
    borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem',
  },
  sectionTitle: {
    display: 'flex', alignItems: 'center', gap: '8px',
    fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.25rem',
    color: 'var(--gray-700)',
  },
  grid4: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1rem',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '0.825rem', fontWeight: 600, color: 'var(--gray-700)' },
  input: {
    padding: '9px 12px', border: '1px solid var(--gray-200)',
    borderRadius: '8px', fontSize: '0.875rem', color: 'var(--gray-900)',
    background: 'var(--white)', width: '100%',
    transition: 'border-color 0.2s',
  },
  inputErr: { borderColor: 'var(--red)' },
  err: { fontSize: '0.75rem', color: 'var(--red)' },
  textarea: { resize: 'vertical', minHeight: '120px' },
  formActions: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  submitBtn: {
    padding: '11px 28px', background: 'var(--green-dark)',
    color: 'var(--white)', border: 'none', borderRadius: '8px',
    fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
  },
  cancelBtn: {
    padding: '11px 24px', background: 'var(--white)',
    border: '1px solid var(--gray-300)', color: 'var(--gray-600)',
    borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
  },
}

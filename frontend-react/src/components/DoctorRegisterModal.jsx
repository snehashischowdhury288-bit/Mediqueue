import React, { useState } from 'react';

export default function DoctorRegisterModal({ onClose, onRegister }) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('42');
  const [department, setDepartment] = useState('Cardiology');
  const [doctorCode, setDoctorCode] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Doctor name is required.');
      return;
    }
    const finalCode = (doctorCode.trim() || `DOC${Math.floor(100 + Math.random() * 900)}`).toUpperCase();

    try {
      const newDoc = await onRegister({
        name: name.trim(),
        age: parseInt(age, 10) || 40,
        department: department.trim(),
        doctorCode: finalCode,
        batches: [
          { batchId: 'b1', name: 'Morning Batch', startTime: '10:00', maxSlots: 5 },
          { batchId: 'b2', name: 'Evening Batch', startTime: '16:00', maxSlots: 5 }
        ]
      });
      onClose(newDoc);
    } catch (err) {
      setError(err.message || 'Failed to register doctor.');
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="dialog-box" style={{ maxWidth: '480px' }}>
        <div className="dialog-header">
          <h3 className="dialog-title">
            <i className="fa-solid fa-user-doctor text-blue"></i> Onboard Doctor Profile
          </h3>
          <button type="button" className="btn-close-dialog" onClick={() => onClose(null)}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
              Register an authentic clinician profile stored dynamically in <code>mediqueue_doctors</code> with automatic 5-patient batch scheduling.
            </p>

            {error && (
              <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '8px 12px', borderRadius: '8px', fontSize: '12.5px' }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label>Doctor Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Dr. Sarah Khan"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label>Age</label>
                <input
                  type="number"
                  min="25"
                  max="90"
                  value={age}
                  onChange={e => setAge(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Department *</label>
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                >
                  <option value="Cardiology">Cardiology</option>
                  <option value="General Medicine">General Medicine</option>
                  <option value="Neurology">Neurology</option>
                  <option value="Pediatrics">Pediatrics</option>
                  <option value="Orthopedics">Orthopedics</option>
                  <option value="Dermatology">Dermatology</option>
                  <option value="Ophthalmology">Ophthalmology</option>
                  <option value="Odontology">Odontology</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Custom Doctor Code (for Patient Linking) *</label>
              <input
                type="text"
                placeholder="e.g. DOC101 (or leave blank to auto-generate)"
                value={doctorCode}
                onChange={e => setDoctorCode(e.target.value.toUpperCase())}
                style={{ textTransform: 'uppercase', fontFamily: 'monospace' }}
              />
              <small style={{ color: '#64748B', fontSize: '11px', marginTop: '4px' }}>
                Patients will use this code to book consultations directly into your queue.
              </small>
            </div>

            <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#3E69FE', letterSpacing: '0.5px' }}>
                DEFAULT BATCH ARCHITECTURE:
              </span>
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                • <strong>Batch 1 (Morning):</strong> 10:00 (5 Max Slots)<br />
                • <strong>Batch 2 (Evening):</strong> 16:00 (5 Max Slots)
              </div>
            </div>
          </div>

          <div className="dialog-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-secondary-action"
              onClick={() => onClose(null)}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary-action">
              <i className="fa-solid fa-check"></i> Register Doctor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

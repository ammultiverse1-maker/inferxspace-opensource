import { useState } from 'react'
import { X, User, Mail, Building, UserCircle } from 'lucide-react'

const ProfileModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    fullName: 'Diya Karthik',
    email: 'diyakarthik@email.com',
    company: 'InferX AI',
    role: 'Engineering Lead'
  })

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSave = () => {
    // Save logic here
    console.log('Saving profile:', formData)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Profile Settings</h2>
          <p>Manage your account information</p>
        </div>

        <div className="modal-body">
          {/* Avatar Section */}
          <div className="avatar-section">
            <div className="avatar-large">
              <span>KM</span>
            </div>
            <button className="btn-change-photo">
              Change Photo
            </button>
          </div>

          {/* Form Fields */}
          <div className="profile-form">
            <div className="form-group">
              <label>Full Name</label>
              <div className="input-with-icon">
                <User size={18} className="input-icon" />
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder="Enter your full name"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <div className="input-with-icon">
                <Mail size={18} className="input-icon" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Company</label>
              <div className="input-with-icon">
                <Building size={18} className="input-icon" />
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                  placeholder="Enter company name"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Role</label>
              <div className="input-with-icon">
                <UserCircle size={18} className="input-icon" />
                <input
                  type="text"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  placeholder="Enter your role"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-save" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProfileModal

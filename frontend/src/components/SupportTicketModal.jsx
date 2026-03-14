import React, { useState } from 'react';
import { X, FileText, AlertCircle, CheckCircle, Loader, Wrench, CreditCard, Bot, BookOpen, User, HelpCircle } from 'lucide-react';
import api from '../api/client.js';
import './SupportTicketModal.css';

const SupportTicketModal = ({ isOpen, onClose, chatContext }) => {
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    category: 'general',
    priority: 'medium'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // null, 'success', 'error'

  const categories = [
    { value: 'api_issues', label: 'API Issues', icon: Wrench },
    { value: 'billing', label: 'Billing & Credits', icon: CreditCard },
    { value: 'models', label: 'Models & Pricing', icon: Bot },
    { value: 'knowledge_base', label: 'Knowledge Base', icon: BookOpen },
    { value: 'account', label: 'Account Issues', icon: User },
    { value: 'general', label: 'General Inquiry', icon: HelpCircle }
  ];

  const priorities = [
    { value: 'low', label: 'Low', color: 'var(--success)' },
    { value: 'medium', label: 'Medium', color: 'var(--warning)' },
    { value: 'high', label: 'High', color: 'var(--error)' },
    { value: 'urgent', label: 'Urgent', color: 'var(--error)' }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      // Include chat context if available
      const ticketData = {
        ...formData,
        description: chatContext
          ? `${formData.description}\n\n--- Chat Context ---\n${chatContext}`
          : formData.description
      };

      await api.post('/api/v1/support/tickets', ticketData);

      setSubmitStatus('success');
      setFormData({
        subject: '',
        description: '',
        category: 'general',
        priority: 'medium'
      });

      // Close modal after success
      setTimeout(() => {
        onClose();
        setSubmitStatus(null);
      }, 2000);

    } catch (error) {
      console.error('Failed to create ticket:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="support-modal-overlay" onClick={onClose}>
      <div className="support-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="support-modal-header">
          <div className="modal-header-content">
            <FileText size={24} className="modal-icon" />
            <div>
              <h2>Create Support Ticket</h2>
              <p>Get help from our support team</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="support-form">
          {/* Subject */}
          <div className="form-group">
            <label htmlFor="subject">Subject *</label>
            <input
              type="text"
              id="subject"
              name="subject"
              value={formData.subject}
              onChange={handleInputChange}
              placeholder="Brief description of your issue"
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Category */}
          <div className="form-group">
            <label>Category *</label>
            <div className="category-grid">
              {categories.map((category) => (
                <label
                  key={category.value}
                  className={`category-option ${
                    formData.category === category.value ? 'selected' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={category.value}
                    checked={formData.category === category.value}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                  />
                  <category.icon size={20} />
                  <span className="category-label">{category.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="form-group">
            <label>Priority</label>
            <div className="priority-options">
              {priorities.map((priority) => (
                <label
                  key={priority.value}
                  className={`priority-option ${
                    formData.priority === priority.value ? 'selected' : ''
                  }`}
                  style={{ '--priority-color': priority.color }}
                >
                  <input
                    type="radio"
                    name="priority"
                    value={priority.value}
                    checked={formData.priority === priority.value}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                  />
                  <span className="priority-label">{priority.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="description">Description *</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Please provide detailed information about your issue..."
              rows={6}
              required
              disabled={isSubmitting}
            />
            {chatContext && (
              <div className="chat-context-notice">
                <AlertCircle size={16} />
                <span>Chat context will be included with this ticket</span>
              </div>
            )}
          </div>

          {/* Submit Status */}
          {submitStatus && (
            <div className={`submit-status ${submitStatus}`}>
              {submitStatus === 'success' ? (
                <>
                  <CheckCircle size={20} />
                  <span>Ticket created successfully! We'll get back to you soon.</span>
                </>
              ) : (
                <>
                  <AlertCircle size={20} />
                  <span>Failed to create ticket. Please try again.</span>
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="form-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting || !formData.subject.trim() || !formData.description.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader size={16} className="spinning" />
                  Creating Ticket...
                </>
              ) : (
                'Create Ticket'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SupportTicketModal;
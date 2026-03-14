import React, { useEffect, useRef, useState } from 'react';
import { X, ChevronDown } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, subtitle, children, size = 'md', className = '' }) => {
  const modalBodyRef = useRef(null)
  const [canScrollDown, setCanScrollDown] = useState(false)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    const updateCanScroll = () => {
      const el = modalBodyRef.current
      if (!el) return setCanScrollDown(false)
      // show arrow when there's overflow and user hasn't reached bottom
      const hasOverflow = el.scrollHeight > el.clientHeight + 8
      const atBottom = el.scrollTop >= el.scrollHeight - el.clientHeight - 8
      setCanScrollDown(hasOverflow && !atBottom)
    }
    updateCanScroll()
    window.addEventListener('resize', updateCanScroll)

    // attach scroll listener to modal body to toggle arrow visibility
    const el = modalBodyRef.current
    if (el) el.addEventListener('scroll', updateCanScroll)

    return () => {
      window.removeEventListener('resize', updateCanScroll)
      if (el) el.removeEventListener('scroll', updateCanScroll)
    }
  }, [isOpen, children])

  if (!isOpen) return null

  const handleScrollDown = () => {
    const el = modalBodyRef.current
    if (!el) return
    el.scrollBy({ top: el.clientHeight - 80, behavior: 'smooth' })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-content modal-${size} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >

        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          <X />
        </button>

        {title && (
          <div className="modal-header">
            <h2>{title}</h2>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
        )}

        <div className="modal-body" ref={modalBodyRef}>
          {children}
        </div>

        {canScrollDown && (
          <button
            className="modal-scroll-down"
            onClick={handleScrollDown}
            aria-label="Scroll down"
          >
            <ChevronDown />
          </button>
        )}
      </div>
    </div>
  )
}

export default Modal

'use client'
import dynamic from 'next/dynamic'
import 'react-datepicker/dist/react-datepicker.css'

// react-datepicker is a sizeable dependency. Defer it until a form that uses a
// date field is actually rendered so it stays out of each route's initial bundle.
const DatePicker = dynamic(() => import('react-datepicker'), {
  ssr: false,
  loading: ({ id, className, placeholderText }) => (
    <input
      id={id}
      className={className || 'form-input'}
      placeholder={placeholderText || 'Select date'}
      readOnly
    />
  ),
})

export default DatePicker

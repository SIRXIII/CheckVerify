import React, { useState } from 'react';
import { User } from 'lucide-react';

interface GuestInfoStepProps {
  formData: {
    firstName: string;
    lastName: string;
    email: string;
    checkInDate: string;
    checkOutDate: string;
    reservationAmount: string;
    bookingPlatform: string;
  };
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onNext: () => void;
}

export function GuestInfoStep({ formData, onChange, onNext }: GuestInfoStepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Please enter a valid email address';
      }
    }

    if (!formData.checkInDate) newErrors.checkInDate = 'Check-in date is required';
    if (!formData.checkOutDate) newErrors.checkOutDate = 'Check-out date is required';

    if (!formData.reservationAmount.trim()) {
      newErrors.reservationAmount = 'Reservation amount is required';
    } else if (isNaN(Number(formData.reservationAmount)) || Number(formData.reservationAmount) <= 0) {
      newErrors.reservationAmount = 'Please enter a valid amount';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      onNext();
    }
  };

  const inputClass = (field: string) =>
    `w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-hostla-primary focus:border-transparent transition-all duration-200 ${
      errors[field] ? 'border-red-400' : 'border-gray-300'
    }`;

  return (
    <div>
      <h2 className="text-2xl font-heading font-semibold text-gray-900 mb-8 flex items-center space-x-3">
        <div className="bg-hostla-light p-2 rounded-lg">
          <User className="h-6 w-6 text-hostla-primary" />
        </div>
        <span>Guest Information</span>
      </h2>

      <div className="grid md:grid-cols-2 gap-6">
        {/* First Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            First Name *
          </label>
          <input
            type="text"
            name="firstName"
            value={formData.firstName}
            onChange={onChange}
            className={inputClass('firstName')}
            placeholder="Enter your first name"
          />
          {errors.firstName && (
            <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
          )}
        </div>

        {/* Last Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Last Name *
          </label>
          <input
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={onChange}
            className={inputClass('lastName')}
            placeholder="Enter your last name"
          />
          {errors.lastName && (
            <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address *
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={onChange}
            className={inputClass('email')}
            placeholder="Enter your email address"
          />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1">{errors.email}</p>
          )}
        </div>

        {/* Booking Platform */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Booking Platform *
          </label>
          <select
            name="bookingPlatform"
            value={formData.bookingPlatform}
            onChange={onChange}
            className={inputClass('bookingPlatform')}
          >
            <option value="Booking.com">Booking.com</option>
            <option value="Expedia">Expedia</option>
            <option value="Hotels.com">Hotels.com</option>
            <option value="Airbnb">Airbnb</option>
            <option value="Direct Booking">Direct Booking</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Check-in Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Check-in Date *
          </label>
          <input
            type="date"
            name="checkInDate"
            value={formData.checkInDate}
            onChange={onChange}
            className={inputClass('checkInDate')}
          />
          {errors.checkInDate && (
            <p className="text-red-500 text-xs mt-1">{errors.checkInDate}</p>
          )}
        </div>

        {/* Check-out Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Check-out Date *
          </label>
          <input
            type="date"
            name="checkOutDate"
            value={formData.checkOutDate}
            onChange={onChange}
            className={inputClass('checkOutDate')}
          />
          {errors.checkOutDate && (
            <p className="text-red-500 text-xs mt-1">{errors.checkOutDate}</p>
          )}
        </div>

        {/* Reservation Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reservation Amount *
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg">
              $
            </span>
            <input
              type="number"
              name="reservationAmount"
              value={formData.reservationAmount}
              onChange={onChange}
              step="0.01"
              min="0"
              className={`${inputClass('reservationAmount')} pl-10 text-lg`}
              placeholder="0.00"
            />
          </div>
          {errors.reservationAmount && (
            <p className="text-red-500 text-xs mt-1">{errors.reservationAmount}</p>
          )}
        </div>
      </div>

      {/* Next Button */}
      <div className="flex justify-end mt-10">
        <button
          type="button"
          onClick={handleNext}
          className="bg-hostla-primary hover:bg-hostla-secondary text-white px-8 py-3 rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          Next
        </button>
      </div>
    </div>
  );
}

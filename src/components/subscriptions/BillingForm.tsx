'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';

export interface BillingData {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  address: string;
  city: string;
  zipCode: string;
}

interface BillingFormProps {
  initialEmail?: string;
  onDataChange: (data: BillingData) => void;
  isValid: boolean;
  onValidChange: (valid: boolean) => void;
}

const COUNTRIES = [
  'Argentina', 'Bolivia', 'Brasil', 'Chile', 'Colombia', 'Costa Rica',
  'Cuba', 'República Dominicana', 'Ecuador', 'El Salvador', 'Guatemala',
  'Honduras', 'México', 'Nicaragua', 'Panamá', 'Paraguay', 'Perú',
  'Puerto Rico', 'Uruguay', 'Venezuela', 'España', 'Otros'
];

export default function BillingForm({
  initialEmail = '',
  onDataChange,
  onValidChange,
}: BillingFormProps) {
  const [data, setData] = useState<BillingData>({
    fullName: '',
    email: initialEmail,
    phone: '',
    country: '',
    address: '',
    city: '',
    zipCode: '',
  });

  const [errors, setErrors] = useState<Partial<BillingData>>({});

  const requiredFields: (keyof BillingData)[] = ['fullName', 'email', 'phone', 'country', 'address', 'city'];

  const validateField = (field: keyof BillingData, value: string) => {
    let error = '';

    if (requiredFields.includes(field) && !value.trim()) {
      error = 'Este campo es requerido';
    } else if (field === 'email' && value && !value.includes('@')) {
      error = 'Email inválido';
    } else if (field === 'phone' && value && value.length < 10) {
      error = 'Teléfono debe tener al menos 10 dígitos';
    }

    return error;
  };

  const handleChange = (field: keyof BillingData, value: string) => {
    const newData = { ...data, [field]: value };
    setData(newData);

    const error = validateField(field, value);
    setErrors({ ...errors, [field]: error });

    const isValid = requiredFields.every(f => {
      const val = f === field ? value : data[f];
      return val.trim() !== '';
    });

    onValidChange(isValid && Object.values(errors).filter(e => e).length === 0);
    onDataChange(newData);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 pb-3 border-b border-white/10">
        <h3 className="text-sm font-medium text-white">Datos de Facturación</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor="fullName" className="text-xs uppercase tracking-wide text-white/60 mb-2 block">
            Nombre Completo
          </Label>
          <Input
            id="fullName"
            placeholder="Juan Pérez"
            value={data.fullName}
            onChange={(e) => handleChange('fullName', e.target.value)}
            className={`bg-white/5 border ${errors.fullName ? 'border-red-500/50' : 'border-white/10'} rounded-lg h-9 text-sm`}
          />
          {errors.fullName && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.fullName}
            </p>
          )}
        </div>

        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor="email" className="text-xs uppercase tracking-wide text-white/60 mb-2 block">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="correo@ejemplo.com"
            value={data.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className={`bg-white/5 border ${errors.email ? 'border-red-500/50' : 'border-white/10'} rounded-lg h-9 text-sm`}
          />
          {errors.email && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.email}
            </p>
          )}
        </div>

        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor="phone" className="text-xs uppercase tracking-wide text-white/60 mb-2 block">
            Teléfono
          </Label>
          <Input
            id="phone"
            placeholder="+1 (555) 123-4567"
            value={data.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className={`bg-white/5 border ${errors.phone ? 'border-red-500/50' : 'border-white/10'} rounded-lg h-9 text-sm`}
          />
          {errors.phone && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.phone}
            </p>
          )}
        </div>

        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor="country" className="text-xs uppercase tracking-wide text-white/60 mb-2 block">
            País
          </Label>
          <select
            id="country"
            value={data.country}
            onChange={(e) => handleChange('country', e.target.value)}
            className={`w-full bg-white/5 border ${errors.country ? 'border-red-500/50' : 'border-white/10'} rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500`}
          >
            <option value="" className="bg-black">Seleccionar país</option>
            {COUNTRIES.map((country) => (
              <option key={country} value={country} className="bg-black">
                {country}
              </option>
            ))}
          </select>
          {errors.country && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.country}
            </p>
          )}
        </div>

        <div className="col-span-2">
          <Label htmlFor="address" className="text-xs uppercase tracking-wide text-white/60 mb-2 block">
            Dirección
          </Label>
          <Input
            id="address"
            placeholder="Calle principal 123, Apt 4B"
            value={data.address}
            onChange={(e) => handleChange('address', e.target.value)}
            className={`bg-white/5 border ${errors.address ? 'border-red-500/50' : 'border-white/10'} rounded-lg h-9 text-sm`}
          />
          {errors.address && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.address}
            </p>
          )}
        </div>

        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor="city" className="text-xs uppercase tracking-wide text-white/60 mb-2 block">
            Ciudad
          </Label>
          <Input
            id="city"
            placeholder="Buenos Aires"
            value={data.city}
            onChange={(e) => handleChange('city', e.target.value)}
            className={`bg-white/5 border ${errors.city ? 'border-red-500/50' : 'border-white/10'} rounded-lg h-9 text-sm`}
          />
          {errors.city && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.city}
            </p>
          )}
        </div>

        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor="zipCode" className="text-xs uppercase tracking-wide text-white/60 mb-2 block">
            Código Postal
          </Label>
          <Input
            id="zipCode"
            placeholder="1234"
            value={data.zipCode}
            onChange={(e) => handleChange('zipCode', e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg h-9 text-sm"
          />
        </div>
      </div>
    </div>
  );
}

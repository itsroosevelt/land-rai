'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface BillingData {
  email: string;
  phonePrefix: string;
  phone: string;
  fullName: string;
  country: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
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
  'Puerto Rico', 'Uruguay', 'Venezuela', 'España', 'Estados Unidos', 'Otros'
];

export default function BillingForm({
  initialEmail = '',
  onDataChange,
  onValidChange,
}: BillingFormProps) {
  const [data, setData] = useState<BillingData>({
    email: initialEmail,
    phonePrefix: '+1',
    phone: '',
    fullName: '',
    country: 'Estados Unidos',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
  });

  const requiredFields: (keyof BillingData)[] = ['email', 'phone', 'fullName', 'country', 'addressLine1', 'city', 'state', 'zipCode'];

  const handleChange = (field: keyof BillingData, value: string) => {
    const newData = { ...data, [field]: value };
    setData(newData);

    const isValid = requiredFields.every(f => {
      const val = f === field ? value : data[f];
      return val.trim() !== '';
    });
    
    // Check basic email structure
    const isEmailValid = newData.email.includes('@');

    onValidChange(isValid && isEmailValid);
    onDataChange(newData);
  };

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <Label htmlFor="fullName" className="text-xs font-medium text-white/80 mb-1.5 block">
          Full name
        </Label>
        <Input
          id="fullName"
          placeholder="John Doe"
          value={data.fullName}
          onChange={(e) => handleChange('fullName', e.target.value)}
          className="bg-white/5 border-white/10 h-9 text-xs text-white placeholder:text-white/40 rounded-lg focus-visible:ring-1 focus-visible:ring-blue-500"
        />
      </div>

      {/* Email */}
      <div>
        <Label htmlFor="email" className="text-xs font-medium text-white/80 mb-1.5 block">
          Email address
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="email@example.com"
          value={data.email}
          onChange={(e) => handleChange('email', e.target.value)}
          className="bg-white/5 border-white/10 h-9 text-xs text-white placeholder:text-white/40 rounded-lg focus-visible:ring-1 focus-visible:ring-blue-500"
        />
      </div>

      {/* Phone */}
      <div>
        <Label htmlFor="phone" className="text-xs font-medium text-white/80 mb-1.5 block">
          Phone number
        </Label>
        <div className="flex bg-white/5 border border-white/10 rounded-lg focus-within:ring-1 focus-within:ring-blue-500 overflow-hidden h-9">
          <select 
            value={data.phonePrefix}
            onChange={(e) => handleChange('phonePrefix', e.target.value)}
            className="bg-transparent border-r border-white/10 text-xs text-white/80 px-2 focus:outline-none appearance-none cursor-pointer"
          >
            <option value="+1" className="bg-[#111]">🇺🇸 +1</option>
            <option value="+34" className="bg-[#111]">🇪🇸 +34</option>
            <option value="+52" className="bg-[#111]">🇲🇽 +52</option>
            <option value="+54" className="bg-[#111]">🇦🇷 +54</option>
            <option value="+57" className="bg-[#111]">🇨🇴 +57</option>
            <option value="+51" className="bg-[#111]">🇵🇪 +51</option>
            <option value="+56" className="bg-[#111]">🇨🇱 +56</option>
            <option value="+58" className="bg-[#111]">🇻🇪 +58</option>
            <option value="+593" className="bg-[#111]">🇪🇨 +593</option>
            <option value="+507" className="bg-[#111]">🇵🇦 +507</option>
            <option value="+506" className="bg-[#111]">🇨🇷 +506</option>
            <option value="+502" className="bg-[#111]">🇬🇹 +502</option>
            <option value="+503" className="bg-[#111]">🇸🇻 +503</option>
            <option value="+504" className="bg-[#111]">🇭🇳 +504</option>
            <option value="+505" className="bg-[#111]">🇳🇮 +505</option>
            <option value="+591" className="bg-[#111]">🇧🇴 +591</option>
            <option value="+595" className="bg-[#111]">🇵🇾 +595</option>
            <option value="+598" className="bg-[#111]">🇺🇾 +598</option>
            <option value="+1" className="bg-[#111]">🇵🇷 +1</option>
            <option value="+53" className="bg-[#111]">🇨🇺 +53</option>
          </select>
          <Input
            id="phone"
            type="tel"
            placeholder="555 123 4567"
            value={data.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className="flex-1 border-none bg-transparent h-9 text-xs text-white placeholder:text-white/40 focus-visible:ring-0 rounded-none shadow-none px-3"
          />
        </div>
      </div>

      {/* Billing Address Group */}
      <div>
        <Label className="text-xs font-medium text-white/80 mb-1.5 block">
          Billing address
        </Label>
        <div className="flex flex-col border border-white/10 rounded-lg overflow-hidden bg-white/5 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
          
          {/* Country */}
          <select
            value={data.country}
            onChange={(e) => handleChange('country', e.target.value)}
            className="w-full h-9 bg-transparent px-3 text-xs text-white focus:outline-none border-b border-white/10 appearance-none cursor-pointer"
          >
            <option value="" disabled className="bg-[#111]">Select country</option>
            {COUNTRIES.map((country) => (
              <option key={country} value={country} className="bg-[#111]">
                {country}
              </option>
            ))}
          </select>

          {/* Address Line 1 */}
          <input
            type="text"
            placeholder="Address line 1"
            value={data.addressLine1}
            onChange={(e) => handleChange('addressLine1', e.target.value)}
            className="w-full h-9 bg-transparent px-3 text-xs text-white placeholder:text-white/40 border-b border-white/10 focus:outline-none"
          />

          {/* Address Line 2 */}
          <input
            type="text"
            placeholder="Address line 2"
            value={data.addressLine2}
            onChange={(e) => handleChange('addressLine2', e.target.value)}
            className="w-full h-9 bg-transparent px-3 text-xs text-white placeholder:text-white/40 border-b border-white/10 focus:outline-none"
          />

          {/* City and Zip Split */}
          <div className="flex border-b border-white/10">
            <input
              type="text"
              placeholder="City"
              value={data.city}
              onChange={(e) => handleChange('city', e.target.value)}
              className="w-1/2 h-9 bg-transparent px-3 text-xs text-white placeholder:text-white/40 border-r border-white/10 focus:outline-none"
            />
            <input
              type="text"
              placeholder="ZIP code"
              value={data.zipCode}
              onChange={(e) => handleChange('zipCode', e.target.value)}
              className="w-1/2 h-9 bg-transparent px-3 text-xs text-white placeholder:text-white/40 focus:outline-none"
            />
          </div>

          {/* State */}
          <input
            type="text"
            placeholder="State"
            value={data.state}
            onChange={(e) => handleChange('state', e.target.value)}
            className="w-full h-9 bg-transparent px-3 text-xs text-white placeholder:text-white/40 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}

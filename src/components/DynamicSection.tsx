'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit3, Save, X, Plus, Trash2 } from 'lucide-react';

interface DynamicSectionProps {
  title: string;
  icon: string;
  data: Record<string, any>;
  isEditing?: boolean;
  onSave?: (data: Record<string, any>) => void;
  onEdit?: () => void;
  onCancel?: () => void;
  colorScheme?: 'default' | 'blue' | 'green' | 'purple' | 'orange' | 'slate';
}

export function DynamicSection({
  title,
  icon,
  data = {},
  isEditing = false,
  onSave,
  onEdit,
  onCancel,
  colorScheme = 'default'
}: DynamicSectionProps) {
  const [editData, setEditData] = useState(data);

  const colorClasses = {
    default: 'bg-white dark:bg-gray-950',
    blue: 'bg-blue-50 dark:bg-blue-900/20',
    green: 'bg-green-50 dark:bg-green-900/20',
    purple: 'bg-purple-50 dark:bg-purple-900/20',
    orange: 'bg-orange-50 dark:bg-orange-900/20',
    slate: 'bg-slate-50 dark:bg-slate-900/20'
  };

  const textColorClasses = {
    default: 'text-gray-900 dark:text-white',
    blue: 'text-blue-900 dark:text-blue-100',
    green: 'text-green-900 dark:text-green-100',
    purple: 'text-purple-900 dark:text-purple-100',
    orange: 'text-orange-900 dark:text-orange-100',
    slate: 'text-slate-900 dark:text-slate-100'
  };

  const handleSave = () => {
    onSave?.(editData);
  };

  const handleCancel = () => {
    setEditData(data);
    onCancel?.();
  };

  const updateField = (key: string, value: any) => {
    setEditData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const addArrayItem = (key: string) => {
    const currentArray = editData[key] || [];
    updateField(key, [...currentArray, '']);
  };

  const updateArrayItem = (key: string, index: number, value: string) => {
    const currentArray = editData[key] || [];
    const newArray = [...currentArray];
    newArray[index] = value;
    updateField(key, newArray);
  };

  const removeArrayItem = (key: string, index: number) => {
    const currentArray = editData[key] || [];
    const newArray = currentArray.filter((_: any, i: number) => i !== index);
    updateField(key, newArray);
  };

  const renderField = (key: string, value: any) => {
    const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

    if (isEditing) {
      if (Array.isArray(value)) {
        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {displayKey}:
              </label>
              <Button
                onClick={() => addArrayItem(key)}
                size="sm"
                variant="outline"
                className="h-6 w-6 p-0"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-1">
              {(editData[key] || []).map((item: string, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={item}
                    onChange={(e) => updateArrayItem(key, index, e.target.value)}
                    className="flex-1"
                    placeholder={`${displayKey} item`}
                  />
                  <Button
                    onClick={() => removeArrayItem(key, index)}
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        );
      } else if (typeof value === 'string' && value.length > 100) {
        return (
          <div key={key}>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {displayKey}:
            </label>
            <Textarea
              value={editData[key] || ''}
              onChange={(e) => updateField(key, e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>
        );
      } else {
        return (
          <div key={key}>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {displayKey}:
            </label>
            <Input
              value={editData[key] || ''}
              onChange={(e) => updateField(key, e.target.value)}
              className="mt-1"
            />
          </div>
        );
      }
    } else {
      // Display mode
      if (Array.isArray(value) && value.length > 0) {
        return (
          <div key={key}>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {displayKey}:
            </label>
            <div className="mt-1 flex flex-wrap gap-1">
              {value.map((item, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {item || 'Empty'}
                </Badge>
              ))}
            </div>
          </div>
        );
      } else if (value) {
        return (
          <div key={key}>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {displayKey}:
            </label>
            <p className={`mt-1 ${textColorClasses[colorScheme]}`}>
              {String(value)}
            </p>
          </div>
        );
      }
      return null;
    }
  };

  return (
    <Card className={`border-0 shadow-sm ${colorClasses[colorScheme]}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className={`flex items-center gap-2 ${textColorClasses[colorScheme]}`}>
            <span>{icon}</span>
            <span>{title}</span>
          </CardTitle>
          {!isEditing && onEdit && (
            <Button
              onClick={onEdit}
              size="sm"
              variant="outline"
              className="h-8"
            >
              <Edit3 className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
          {isEditing && (
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSave}
                size="sm"
                className="h-8"
              >
                <Save className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button
                onClick={handleCancel}
                size="sm"
                variant="outline"
                className="h-8"
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          {Object.entries(isEditing ? editData : data)
            .filter(([_, value]) =>
              value !== null &&
              value !== undefined &&
              value !== '' &&
              (!Array.isArray(value) || value.length > 0)
            )
            .map(([key, value]) => renderField(key, value))
          }

          {Object.keys(data).length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 italic">
              No data available for this section
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
import React from 'react';
import * as LucideIcons from 'lucide-react';

export const Icon = ({ name, className }) => {
  // Convert kebab-case (e.g. bar-chart-3, alert-triangle) to PascalCase (e.g. BarChart3, AlertTriangle)
  const toPascalCase = (str) => {
    if (!str) return '';
    return str
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  };

  const pascalName = toPascalCase(name);
  
  let IconComponent = LucideIcons[pascalName];
  
  if (!IconComponent) {
    // Manual overrides for commonly used icons with custom names in lucide-react
    if (name === 'bar-chart-3') IconComponent = LucideIcons.BarChart3;
    else if (name === 'alert-triangle') IconComponent = LucideIcons.AlertTriangle;
    else if (name === 'trash-2') IconComponent = LucideIcons.Trash2;
    else if (name === 'check-circle') IconComponent = LucideIcons.CheckCircle;
    else if (name === 'file-text') IconComponent = LucideIcons.FileText;
    else if (name === 'trending-up') IconComponent = LucideIcons.TrendingUp;
    else if (name === 'trending-down') IconComponent = LucideIcons.TrendingDown;
    else if (name === 'dollar-sign') IconComponent = LucideIcons.DollarSign;
    else if (name === 'search') IconComponent = LucideIcons.Search;
    else if (name === 'plus') IconComponent = LucideIcons.Plus;
    else if (name === 'settings') IconComponent = LucideIcons.Settings;
    else if (name === 'user') IconComponent = LucideIcons.User;
    else if (name === 'lock') IconComponent = LucideIcons.Lock;
    else if (name === 'eye') IconComponent = LucideIcons.Eye;
    else if (name === 'eye-off') IconComponent = LucideIcons.EyeOff;
    else if (name === 'chevron-down') IconComponent = LucideIcons.ChevronDown;
    else if (name === 'chevron-up') IconComponent = LucideIcons.ChevronUp;
    else IconComponent = LucideIcons.HelpCircle;
  }

  return IconComponent ? <IconComponent className={className} /> : null;
};

export default Icon;

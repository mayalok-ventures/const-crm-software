import React from 'react';
import {
  Briefcase, Zap, Laptop, Crown, Rocket, Globe,
  Sparkles, Building2, Gem, ShieldCheck, User
} from 'lucide-react';

export const AVATAR_ICONS = [
  {
    id: 'avatar-1',
    name: 'Executive Leader',
    role: 'Leadership & Strategy',
    emoji: '👔',
    icon: Briefcase,
    gradient: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    border: '#6366f1',
    shadow: 'rgba(79, 70, 229, 0.4)',
    bgLight: 'rgba(79, 70, 229, 0.1)',
  },
  {
    id: 'avatar-2',
    name: 'Sales Lightning',
    role: 'High-Velocity Closer',
    emoji: '⚡',
    icon: Zap,
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
    border: '#f59e0b',
    shadow: 'rgba(245, 158, 11, 0.4)',
    bgLight: 'rgba(245, 158, 11, 0.1)',
  },
  {
    id: 'avatar-3',
    name: 'Tech Maverick',
    role: 'Digital & Solutions',
    emoji: '💻',
    icon: Laptop,
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)',
    border: '#06b6d4',
    shadow: 'rgba(6, 182, 212, 0.4)',
    bgLight: 'rgba(6, 182, 212, 0.1)',
  },
  {
    id: 'avatar-4',
    name: 'Deal Closer',
    role: 'Enterprise Champion',
    emoji: '👑',
    icon: Crown,
    gradient: 'linear-gradient(135deg, #10b981 0%, #0f766e 100%)',
    border: '#10b981',
    shadow: 'rgba(16, 185, 129, 0.4)',
    bgLight: 'rgba(16, 185, 129, 0.1)',
  },
  {
    id: 'avatar-5',
    name: 'Growth Rocket',
    role: 'Scale & Acquisition',
    emoji: '🚀',
    icon: Rocket,
    gradient: 'linear-gradient(135deg, #f43f5e 0%, #b91c1c 100%)',
    border: '#f43f5e',
    shadow: 'rgba(244, 63, 94, 0.4)',
    bgLight: 'rgba(244, 63, 94, 0.1)',
  },
  {
    id: 'avatar-6',
    name: 'Global Networker',
    role: 'Outreach & Partnerships',
    emoji: '🌐',
    icon: Globe,
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #4338ca 100%)',
    border: '#0ea5e9',
    shadow: 'rgba(14, 165, 233, 0.4)',
    bgLight: 'rgba(14, 165, 233, 0.1)',
  },
  {
    id: 'avatar-7',
    name: 'Star Performer',
    role: 'Customer Delight',
    emoji: '⭐',
    icon: Sparkles,
    gradient: 'linear-gradient(135deg, #a855f7 0%, #db2777 100%)',
    border: '#a855f7',
    shadow: 'rgba(168, 85, 247, 0.4)',
    bgLight: 'rgba(168, 85, 247, 0.1)',
  },
  {
    id: 'avatar-8',
    name: 'Real Estate Titan',
    role: 'Property & Wealth',
    emoji: '🏢',
    icon: Building2,
    gradient: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)',
    border: '#475569',
    shadow: 'rgba(51, 65, 85, 0.4)',
    bgLight: 'rgba(51, 65, 85, 0.1)',
  },
  {
    id: 'avatar-9',
    name: 'FinTech Master',
    role: 'Investment & Finance',
    emoji: '💎',
    icon: Gem,
    gradient: 'linear-gradient(135deg, #2dd4bf 0%, #0e7490 100%)',
    border: '#2dd4bf',
    shadow: 'rgba(45, 212, 191, 0.4)',
    bgLight: 'rgba(45, 212, 191, 0.1)',
  },
  {
    id: 'avatar-10',
    name: 'Elite Shield',
    role: 'Compliance & Security',
    emoji: '🛡️',
    icon: ShieldCheck,
    gradient: 'linear-gradient(135deg, #d97706 0%, #e11d48 100%)',
    border: '#d97706',
    shadow: 'rgba(217, 119, 6, 0.4)',
    bgLight: 'rgba(217, 119, 6, 0.1)',
  },
];

export function getAvatarConfig(avatarId) {
  return AVATAR_ICONS.find(a => a.id === avatarId) || AVATAR_ICONS[0];
}

export function UserAvatarRenderer({ avatarId, size = 48, iconSize = 24, className = '', style = {} }) {
  const config = getAvatarConfig(avatarId);
  const IconComponent = config.icon;

  return (
    <div
      className={`avatar-badge-renderer ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: config.gradient,
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 4px 16px ${config.shadow}`,
        border: `2px solid rgba(255, 255, 255, 0.25)`,
        flexShrink: 0,
        position: 'relative',
        ...style,
      }}
      title={config.name}
    >
      <IconComponent size={iconSize} />
    </div>
  );
}

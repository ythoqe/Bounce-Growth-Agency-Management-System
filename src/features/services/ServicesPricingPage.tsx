import React from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Tag, Plus, Check } from 'lucide-react';

const bounceGrowthServices = [
  {
    name: 'Server-Side Tracking & Meta CAPI',
    category: 'Tracking & Analytics',
    price: '$750 - $1,500 / mo',
    scope: [
      'GTM Server-side container on Stape / Cloud Run',
      'Meta Conversions API with event deduplication',
      'First-party cookie recovery & custom domain setup',
      'Event match quality (EMQ) optimization to 8.0+',
    ],
  },
  {
    name: 'Full-Funnel Meta Ads Management',
    category: 'Paid Media',
    price: '$1,200 - $3,000 / mo',
    scope: [
      'Audience segmentation & creative testing sprints',
      'Catalog & Dynamic Product Ads (DPA)',
      'Scaling budget pacing & ROAS optimization',
      'Weekly performance check-in calls',
    ],
  },
  {
    name: 'Google Ads & Performance Max',
    category: 'Paid Media',
    price: '$1,000 - $2,500 / mo',
    scope: [
      'Search campaign intent keyword harvesting',
      'Performance Max asset group refinement',
      'Offline conversion imports via enhanced conversions',
      'Negative keyword maintenance',
    ],
  },
  {
    name: 'GA4 & Looker Studio Executive Dashboard',
    category: 'Business Intelligence',
    price: '$500 - $1,200 (One-time or Retainer)',
    scope: [
      'Custom GA4 e-commerce funnel exploration',
      'Multi-channel attribution reporting',
      'Interactive executive Looker Studio dashboard',
      'Automated email dispatch to stakeholders',
    ],
  },
  {
    name: 'Conversion Rate Optimization (CRO)',
    category: 'Growth Engineering',
    price: '$800 - $1,800 / mo',
    scope: [
      'Heuristic evaluation of checkout funnel',
      'Mobile user journey drop-off audits',
      'A/B test ideation & statistical tracking',
      'Copywriting & CTA friction removal',
    ],
  },
];

export function ServicesPricingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Services & Pricing Rate Cards"
        description="Standardized agency service deliverables, recurring retainer packages, and setup fees for Bounce Growth offerings."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {}}
          >
            Add Service Package
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {bounceGrowthServices.map((service) => (
          <Card key={service.name} className="flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium pb-2 border-b border-slate-100">
                <span>{service.category}</span>
                <Tag className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mt-3">{service.name}</h3>
              <p className="text-sm font-bold text-blue-600 mt-1 tabular-nums">{service.price}</p>
              <div className="mt-4 space-y-2">
                {service.scope.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100">
              <Button variant="outline" size="sm" className="w-full text-xs">
                Edit Rate Card
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

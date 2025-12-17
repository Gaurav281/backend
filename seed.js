require('dotenv').config();
const mongoose = require('mongoose');

/* ===================== MODEL ===================== */
const Service = require('./src/models/Service');

/* ===================== CONFIG ===================== */
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/digital_services';

/* ===================== CONNECT DB ===================== */
const connectDB = async () => {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ MongoDB connected for service seeding');
};

/* ===================== CLEAR SERVICES ===================== */
const clearServices = async () => {
  await Service.deleteMany({});
  console.log('🧹 Existing services cleared');
};

/* ===================== CREATE SERVICES ===================== */
const createServices = async () => {
  const services = await Service.insertMany([
    /* ===================== SAAS ===================== */
    {
      name: 'CRM SaaS Platform',
      description: 'Cloud-based CRM for managing leads and customers',
      category: 'saas',
      price: 4999,
      duration: '30 days',
      features: ['Lead Tracking', 'Analytics Dashboard', 'Team Management'],
      isPopular: true,
      enrolledCount: 12,
      meta: { views: 150, rating: 4.5 }
    },
    {
      name: 'Invoice Management SaaS',
      description: 'Automated invoicing and billing system',
      category: 'saas',
      price: 2999,
      duration: '30 days',
      features: ['Auto Invoices', 'GST Reports', 'Payment Tracking'],
      enrolledCount: 7,
      meta: { views: 90, rating: 4.2 }
    },

    /* ===================== SOCIAL ===================== */
    {
      name: 'Instagram Growth Service',
      description: 'Increase Instagram reach and engagement organically',
      category: 'social',
      price: 1999,
      duration: '30 days',
      features: ['Content Strategy', 'Hashtag Research', 'Growth Reports'],
      enrolledCount: 18,
      meta: { views: 210, rating: 4.6 }
    },
    {
      name: 'YouTube Channel Management',
      description: 'Complete YouTube channel handling and optimization',
      category: 'social',
      price: 3499,
      duration: '30 days',
      features: ['SEO Titles', 'Thumbnail Strategy', 'Analytics'],
      enrolledCount: 9,
      meta: { views: 120, rating: 4.3 }
    },

    /* ===================== SEO ===================== */
    {
      name: 'On-Page SEO Optimization',
      description: 'Optimize website pages for search engines',
      category: 'seo',
      price: 1499,
      duration: '30 days',
      features: ['Keyword Optimization', 'Meta Tags', 'Content Audit'],
      enrolledCount: 14,
      meta: { views: 160, rating: 4.4 }
    },
    {
      name: 'Backlink Building Service',
      description: 'High-quality backlinks to improve ranking',
      category: 'seo',
      price: 2499,
      duration: '30 days',
      features: ['Guest Posts', 'High DA Links', 'SEO Report'],
      enrolledCount: 6,
      meta: { views: 100, rating: 4.1 }
    },

    /* ===================== WEB ===================== */
    {
      name: 'Business Website Development',
      description: 'Responsive business website with modern UI',
      category: 'web',
      price: 5999,
      duration: '45 days',
      features: ['Responsive Design', 'SEO Ready', 'Admin Panel'],
      isPopular: true,
      enrolledCount: 10,
      meta: { views: 180, rating: 4.7 }
    },
    {
      name: 'E-commerce Website',
      description: 'Online store with payment gateway integration',
      category: 'web',
      price: 8999,
      duration: '60 days',
      features: ['Product Management', 'Payment Gateway', 'Order Tracking'],
      enrolledCount: 4,
      meta: { views: 140, rating: 4.5 }
    },

    /* ===================== MARKETING ===================== */
    {
      name: 'Google Ads Campaign',
      description: 'Run and optimize Google Ads for better ROI',
      category: 'marketing',
      price: 2999,
      duration: '30 days',
      features: ['Keyword Research', 'Ad Optimization', 'Conversion Tracking'],
      enrolledCount: 11,
      meta: { views: 130, rating: 4.3 }
    },
    {
      name: 'Email Marketing Service',
      description: 'Targeted email campaigns for customer retention',
      category: 'marketing',
      price: 1799,
      duration: '30 days',
      features: ['Email Templates', 'Automation', 'Analytics'],
      enrolledCount: 8,
      meta: { views: 95, rating: 4.0 }
    },

    /* ===================== OTHER ===================== */
    {
      name: 'Tech Consultation',
      description: 'One-on-one technical consultation session',
      category: 'other',
      price: 999,
      duration: '7 days',
      features: ['Project Guidance', 'Architecture Review', 'Q&A Session'],
      enrolledCount: 20,
      meta: { views: 220, rating: 4.8 }
    },
    {
      name: 'Startup Mentorship',
      description: 'Mentorship for startups and early founders',
      category: 'other',
      price: 3999,
      duration: '30 days',
      features: ['Business Strategy', 'Tech Stack Help', 'Weekly Calls'],
      enrolledCount: 5,
      meta: { views: 110, rating: 4.6 }
    }
  ]);

  console.log(`📦 ${services.length} services created`);
};

/* ===================== MAIN ===================== */
const seedServices = async () => {
  try {
    console.log('🌱 Seeding services only...\n');
    await connectDB();
    await clearServices();
    await createServices();
    console.log('\n✅ SERVICE SEEDING COMPLETED');
    process.exit(0);
  } catch (error) {
    console.error('❌ Service seeding failed:', error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  seedServices();
}

module.exports = seedServices;

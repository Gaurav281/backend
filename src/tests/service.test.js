const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const Service = require('../models/Service');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

describe('Service API Tests', () => {
  let adminToken;
  let userToken;
  let adminId;
  let userId;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/digital_services_test');
    
    // Create admin user
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin',
      isVerified: true
    });
    adminId = admin._id;
    adminToken = jwt.sign({ id: adminId }, process.env.JWT_SECRET || 'test_secret');
    
    // Create regular user
    const user = await User.create({
      name: 'Regular User',
      email: 'user@test.com',
      password: 'password123',
      role: 'user',
      isVerified: true
    });
    userId = user._id;
    userToken = jwt.sign({ id: userId }, process.env.JWT_SECRET || 'test_secret');
  });

  afterAll(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Service.deleteMany({});
  });

  describe('GET /api/services', () => {
    beforeEach(async () => {
      await Service.create([
        {
          name: 'Service 1',
          description: 'Description 1',
          category: 'saas',
          features: ['Feature 1', 'Feature 2'],
          price: 99,
          duration: '1 month',
          isActive: true
        },
        {
          name: 'Service 2',
          description: 'Description 2',
          category: 'seo',
          features: ['Feature 1'],
          price: 199,
          duration: '3 months',
          isActive: true
        }
      ]);
    });

    it('should get all services', async () => {
      const res = await request(app)
        .get('/api/services');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.services).toHaveLength(2);
    });

    it('should filter services by category', async () => {
      const res = await request(app)
        .get('/api/services?category=saas');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.services).toHaveLength(1);
      expect(res.body.services[0].category).toBe('saas');
    });
  });

  describe('POST /api/services (Admin)', () => {
    it('should create a new service', async () => {
      const res = await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Service',
          description: 'Service Description',
          category: 'saas',
          features: ['Feature 1', 'Feature 2'],
          price: 299,
          duration: '1 month'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.service.name).toBe('New Service');
    });

    it('should not allow non-admin to create service', async () => {
      const res = await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'New Service',
          description: 'Service Description',
          category: 'saas',
          features: ['Feature 1'],
          price: 299,
          duration: '1 month'
        });

      expect(res.statusCode).toBe(403);
    });
  });
});
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const reportRoutes = require('./routes/reportRoutes');
const crmRoutes = require('./routes/crmRoutes');
const myIbRoutes = require('./routes/myIbRoutes');
const ibremsRoutes = require('./routes/ibremsRoutes');
const grimRoutes = require('./routes/grimRoutes');
const ibGroupRoutes = require('./routes/ibGroupRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Reporting Dashboard Backend is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/myib', myIbRoutes);
app.use('/api/ibrems', ibremsRoutes);
app.use('/api/grim', grimRoutes);
app.use('/api/ib-group', ibGroupRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

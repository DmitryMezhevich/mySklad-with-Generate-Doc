require('dotenv').config({ path: './configuration/.env' });

// process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const express = require('express');
const cors = require('cors');
const mountRouter = require('./router/mountRouter');
const PORT = process.env.PORT || 3000;
const app = express();

app.use(cors());
app.use(express.json());

mountRouter(app);

app.listen(PORT, () => console.log(`Server is running on ${PORT} port!`));

import AdminJS from 'adminjs';
import AdminJSFastify from '@adminjs/fastify';
import * as AdminJSMongoose from '@adminjs/mongoose';

import  User  from '../models/user.js';
import  Admin  from '../models/admin.js';
import  Lab  from '../models/lab.js';
import  Test  from '../models/test.js';
import  Booking  from '../models/booking.js';

import { authenticate, COOKIE_PASSWORD, sessionStore } from './config.js';
import { dark, light } from '@adminjs/themes';

AdminJS.registerAdapter(AdminJSMongoose);

export const admin = new AdminJS({
  resources: [
    {
      resource: User,
      options: {
        listProperties: ['name', 'email', 'role'],
        filterProperties: ['name', 'email', 'role'],
      }
    },
    {
      resource: Admin,
      options: {
        listProperties: ['email', 'role'],
        filterProperties: ['email', 'role'],
      }
    },
    {
      resource: Lab,
      options: {
        listProperties: ['name', 'location'],
      }
    },
    {
      resource: Test,
      options: {
        listProperties: ['name', 'price', ], 
      }
    },
    {
      resource: Booking,
      options: {
        listProperties: ['user', 'lab', 'tests', 'date', 'status'],
      }
    },
  ],
  branding: {
    companyName: "Lab Admin Panel",
    withMadeWithLove: false,
    favicon: "https://res.cloudinary.com/dhyg6igyw/image/upload/v1726832269/mv6kfnszzjmggoyfyjd9.ico",
    logo: "https://res.cloudinary.com/dhyg6igyw/image/upload/v1726832374/xurkrptjzcegfflohmlj.png"
  },
  defaultTheme: dark.id,
  availableThemes: [dark, light],
  rootPath: '/admin'
});

export const buildAdminRouter= async(app)=>{
await AdminJSFastify.buildAuthenticatedRouter(
    admin,
    {
         authenticate,
         cookiePassword:COOKIE_PASSWORD,
         cookieName:"adminjs"
    },
    app,
    {
        store:sessionStore,
        saveUnintialized:true,
        secret:COOKIE_PASSWORD,
        cookie:{
          httpOnly:process.env.NODE_ENV === "production",
          secure:process.env.NODE_ENV === "production",
        }
    }
)
}

export default { admin };

import AdminJS from 'adminjs';
import AdminJSFastify from '@adminjs/fastify';
import * as AdminJSMongoose from '@adminjs/mongoose';

import  User  from '../models/user.js';
import  Admin  from '../models/admin.js';
import  Lab  from '../models/lab.js';
import  Test  from '../models/test.js';
import  Booking  from '../models/booking.js';

import { authenticate, COOKIE_PASSWORD, createSessionStore } from './config.js';
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
        listProperties: ['name', 'address', 'email', 'phone', 'isVerified', 'location.coordinates'],
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
        listProperties: ['user', 'lab', 'tests', 'scheduledDate', 'status', 'totalAmount'],
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
  const store = createSessionStore();
  try {
    await AdminJSFastify.buildAuthenticatedRouter(
      admin,
      {
           authenticate,
           cookiePassword:COOKIE_PASSWORD,
           cookieName:"adminjs"
      },
      app,
      {
          store:store || undefined,
          saveUnintialized:true,
          secret:COOKIE_PASSWORD,
          cookie:{
            httpOnly:process.env.NODE_ENV === "production",
            secure:process.env.NODE_ENV === "production",
          }
      }
    )
  } catch (error) {
    console.log("AdminJS router initialization skipped due to error:", error?.message || error);
  }
}

export default { admin };

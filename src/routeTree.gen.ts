/* eslint-disable */
// @ts-nocheck
import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as LearnIndexRouteImport } from './routes/learn/index'
import { Route as LearnCoursesRouteImport } from './routes/learn/courses'
import { Route as LearnCourseDetailRouteImport } from './routes/learn/courses/$slug'
import { Route as LearnForgotPasswordRouteImport } from './routes/learn/forgot-password'
import { Route as LearnHelpRouteImport } from './routes/learn/help'
import { Route as LearnLoginRouteImport } from './routes/learn/login'
import { Route as LearnMessagesRouteImport } from './routes/learn/messages'
import { Route as LearnNotificationsRouteImport } from './routes/learn/notifications'
import { Route as LearnProfileRouteImport } from './routes/learn/profile'
import { Route as LearnRegisterRouteImport } from './routes/learn/register'
import { Route as LearnResetPasswordRouteImport } from './routes/learn/reset-password'
import { Route as LearnWorkshopsRouteImport } from './routes/learn/workshops'
import { Route as LearnManageCoursesRouteImport } from './routes/learn/manage/courses'

const IndexRoute = IndexRouteImport.update({ id:'/', path:'/', getParentRoute:()=>rootRouteImport } as any)
const LearnIndexRoute = LearnIndexRouteImport.update({ id:'/learn/', path:'/learn/', getParentRoute:()=>rootRouteImport } as any)
const LearnCoursesRoute = LearnCoursesRouteImport.update({ id:'/learn/courses', path:'/learn/courses', getParentRoute:()=>rootRouteImport } as any)
const LearnCourseDetailRoute = LearnCourseDetailRouteImport.update({ id:'/learn/courses/$slug', path:'/learn/courses/$slug', getParentRoute:()=>rootRouteImport } as any)
const LearnForgotPasswordRoute = LearnForgotPasswordRouteImport.update({ id:'/learn/forgot-password', path:'/learn/forgot-password', getParentRoute:()=>rootRouteImport } as any)
const LearnHelpRoute = LearnHelpRouteImport.update({ id:'/learn/help', path:'/learn/help', getParentRoute:()=>rootRouteImport } as any)
const LearnLoginRoute = LearnLoginRouteImport.update({ id:'/learn/login', path:'/learn/login', getParentRoute:()=>rootRouteImport } as any)
const LearnMessagesRoute = LearnMessagesRouteImport.update({ id:'/learn/messages', path:'/learn/messages', getParentRoute:()=>rootRouteImport } as any)
const LearnNotificationsRoute = LearnNotificationsRouteImport.update({ id:'/learn/notifications', path:'/learn/notifications', getParentRoute:()=>rootRouteImport } as any)
const LearnProfileRoute = LearnProfileRouteImport.update({ id:'/learn/profile', path:'/learn/profile', getParentRoute:()=>rootRouteImport } as any)
const LearnRegisterRoute = LearnRegisterRouteImport.update({ id:'/learn/register', path:'/learn/register', getParentRoute:()=>rootRouteImport } as any)
const LearnResetPasswordRoute = LearnResetPasswordRouteImport.update({ id:'/learn/reset-password', path:'/learn/reset-password', getParentRoute:()=>rootRouteImport } as any)
const LearnWorkshopsRoute = LearnWorkshopsRouteImport.update({ id:'/learn/workshops', path:'/learn/workshops', getParentRoute:()=>rootRouteImport } as any)
const LearnManageCoursesRoute = LearnManageCoursesRouteImport.update({ id:'/learn/manage/courses', path:'/learn/manage/courses', getParentRoute:()=>rootRouteImport } as any)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute; '/learn/courses': typeof LearnCoursesRoute; '/learn/courses/$slug': typeof LearnCourseDetailRoute; '/learn/forgot-password': typeof LearnForgotPasswordRoute; '/learn/help': typeof LearnHelpRoute; '/learn/login': typeof LearnLoginRoute; '/learn/messages': typeof LearnMessagesRoute; '/learn/notifications': typeof LearnNotificationsRoute; '/learn/profile': typeof LearnProfileRoute; '/learn/register': typeof LearnRegisterRoute; '/learn/reset-password': typeof LearnResetPasswordRoute; '/learn/workshops': typeof LearnWorkshopsRoute; '/learn/': typeof LearnIndexRoute; '/learn/manage/courses': typeof LearnManageCoursesRoute
}
export interface FileRoutesByTo {
  '/': typeof IndexRoute; '/learn/courses': typeof LearnCoursesRoute; '/learn/courses/$slug': typeof LearnCourseDetailRoute; '/learn/forgot-password': typeof LearnForgotPasswordRoute; '/learn/help': typeof LearnHelpRoute; '/learn/login': typeof LearnLoginRoute; '/learn/messages': typeof LearnMessagesRoute; '/learn/notifications': typeof LearnNotificationsRoute; '/learn/profile': typeof LearnProfileRoute; '/learn/register': typeof LearnRegisterRoute; '/learn/reset-password': typeof LearnResetPasswordRoute; '/learn/workshops': typeof LearnWorkshopsRoute; '/learn': typeof LearnIndexRoute; '/learn/manage/courses': typeof LearnManageCoursesRoute
}
export interface FileRoutesById {
  __root__: typeof rootRouteImport; '/': typeof IndexRoute; '/learn/courses': typeof LearnCoursesRoute; '/learn/courses/$slug': typeof LearnCourseDetailRoute; '/learn/forgot-password': typeof LearnForgotPasswordRoute; '/learn/help': typeof LearnHelpRoute; '/learn/login': typeof LearnLoginRoute; '/learn/messages': typeof LearnMessagesRoute; '/learn/notifications': typeof LearnNotificationsRoute; '/learn/profile': typeof LearnProfileRoute; '/learn/register': typeof LearnRegisterRoute; '/learn/reset-password': typeof LearnResetPasswordRoute; '/learn/workshops': typeof LearnWorkshopsRoute; '/learn/': typeof LearnIndexRoute; '/learn/manage/courses': typeof LearnManageCoursesRoute
}
export interface FileRouteTypes { fileRoutesByFullPath: FileRoutesByFullPath; fullPaths: keyof FileRoutesByFullPath; fileRoutesByTo: FileRoutesByTo; to: keyof FileRoutesByTo; id: keyof FileRoutesById; fileRoutesById: FileRoutesById }
export interface RootRouteChildren { IndexRoute: typeof IndexRoute; LearnCoursesRoute: typeof LearnCoursesRoute; LearnCourseDetailRoute: typeof LearnCourseDetailRoute; LearnForgotPasswordRoute: typeof LearnForgotPasswordRoute; LearnHelpRoute: typeof LearnHelpRoute; LearnLoginRoute: typeof LearnLoginRoute; LearnMessagesRoute: typeof LearnMessagesRoute; LearnNotificationsRoute: typeof LearnNotificationsRoute; LearnProfileRoute: typeof LearnProfileRoute; LearnRegisterRoute: typeof LearnRegisterRoute; LearnResetPasswordRoute: typeof LearnResetPasswordRoute; LearnWorkshopsRoute: typeof LearnWorkshopsRoute; LearnIndexRoute: typeof LearnIndexRoute; LearnManageCoursesRoute: typeof LearnManageCoursesRoute }

const rootRouteChildren = { IndexRoute, LearnCoursesRoute, LearnCourseDetailRoute, LearnForgotPasswordRoute, LearnHelpRoute, LearnLoginRoute, LearnMessagesRoute, LearnNotificationsRoute, LearnProfileRoute, LearnRegisterRoute, LearnResetPasswordRoute, LearnWorkshopsRoute, LearnIndexRoute, LearnManageCoursesRoute }
export const routeTree = rootRouteImport._addFileChildren(rootRouteChildren)._addFileTypes<FileRouteTypes>()

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
import { Route as LearnManageEnrolmentsRouteImport } from './routes/learn/manage/enrolments'
import { Route as LearnManageCourseContentCourseIdRouteImport } from './routes/learn/manage/course-content.$courseId'
import { Route as LearnManageCourseStudentsCourseIdRouteImport } from './routes/learn/manage/course-students.$courseId'
import { Route as LearnManageWorkshopRegistrationsRouteImport } from './routes/learn/manage/workshop-registrations'
import { Route as LearnManageWorkshopsRouteImport } from './routes/learn/manage/workshops'
import { Route as LearnManageChatroomsRouteImport } from './routes/learn/manage/chatrooms'
import { Route as LearnManageAnnouncementsRouteImport } from './routes/learn/manage/announcements'
const IndexRoute=IndexRouteImport.update({id:'/',path:'/',getParentRoute:()=>rootRouteImport}as any)
const LearnIndexRoute=LearnIndexRouteImport.update({id:'/learn/',path:'/learn/',getParentRoute:()=>rootRouteImport}as any)
const LearnCoursesRoute=LearnCoursesRouteImport.update({id:'/learn/courses',path:'/learn/courses',getParentRoute:()=>rootRouteImport}as any)
const LearnCourseDetailRoute=LearnCourseDetailRouteImport.update({id:'/learn/courses/$slug',path:'/learn/courses/$slug',getParentRoute:()=>rootRouteImport}as any)
const LearnForgotPasswordRoute=LearnForgotPasswordRouteImport.update({id:'/learn/forgot-password',path:'/learn/forgot-password',getParentRoute:()=>rootRouteImport}as any)
const LearnHelpRoute=LearnHelpRouteImport.update({id:'/learn/help',path:'/learn/help',getParentRoute:()=>rootRouteImport}as any)
const LearnLoginRoute=LearnLoginRouteImport.update({id:'/learn/login',path:'/learn/login',getParentRoute:()=>rootRouteImport}as any)
const LearnMessagesRoute=LearnMessagesRouteImport.update({id:'/learn/messages',path:'/learn/messages',getParentRoute:()=>rootRouteImport}as any)
const LearnNotificationsRoute=LearnNotificationsRouteImport.update({id:'/learn/notifications',path:'/learn/notifications',getParentRoute:()=>rootRouteImport}as any)
const LearnProfileRoute=LearnProfileRouteImport.update({id:'/learn/profile',path:'/learn/profile',getParentRoute:()=>rootRouteImport}as any)
const LearnRegisterRoute=LearnRegisterRouteImport.update({id:'/learn/register',path:'/learn/register',getParentRoute:()=>rootRouteImport}as any)
const LearnResetPasswordRoute=LearnResetPasswordRouteImport.update({id:'/learn/reset-password',path:'/learn/reset-password',getParentRoute:()=>rootRouteImport}as any)
const LearnWorkshopsRoute=LearnWorkshopsRouteImport.update({id:'/learn/workshops',path:'/learn/workshops',getParentRoute:()=>rootRouteImport}as any)
const LearnManageCoursesRoute=LearnManageCoursesRouteImport.update({id:'/learn/manage/courses',path:'/learn/manage/courses',getParentRoute:()=>rootRouteImport}as any)
const LearnManageEnrolmentsRoute=LearnManageEnrolmentsRouteImport.update({id:'/learn/manage/enrolments',path:'/learn/manage/enrolments',getParentRoute:()=>rootRouteImport}as any)
const LearnManageCourseContentCourseIdRoute=LearnManageCourseContentCourseIdRouteImport.update({id:'/learn/manage/course-content/$courseId',path:'/learn/manage/course-content/$courseId',getParentRoute:()=>rootRouteImport}as any)
const LearnManageCourseStudentsCourseIdRoute=LearnManageCourseStudentsCourseIdRouteImport.update({id:'/learn/manage/course-students/$courseId',path:'/learn/manage/course-students/$courseId',getParentRoute:()=>rootRouteImport}as any)
const LearnManageWorkshopRegistrationsRoute=LearnManageWorkshopRegistrationsRouteImport.update({id:'/learn/manage/workshop-registrations',path:'/learn/manage/workshop-registrations',getParentRoute:()=>rootRouteImport}as any)
const LearnManageWorkshopsRoute=LearnManageWorkshopsRouteImport.update({id:'/learn/manage/workshops',path:'/learn/manage/workshops',getParentRoute:()=>rootRouteImport}as any)
const LearnManageChatroomsRoute=LearnManageChatroomsRouteImport.update({id:'/learn/manage/chatrooms',path:'/learn/manage/chatrooms',getParentRoute:()=>rootRouteImport}as any)
const LearnManageAnnouncementsRoute=LearnManageAnnouncementsRouteImport.update({id:'/learn/manage/announcements',path:'/learn/manage/announcements',getParentRoute:()=>rootRouteImport}as any)
export interface FileRoutesByFullPath {'/':typeof IndexRoute;'/learn/courses':typeof LearnCoursesRoute;'/learn/courses/$slug':typeof LearnCourseDetailRoute;'/learn/forgot-password':typeof LearnForgotPasswordRoute;'/learn/help':typeof LearnHelpRoute;'/learn/login':typeof LearnLoginRoute;'/learn/messages':typeof LearnMessagesRoute;'/learn/notifications':typeof LearnNotificationsRoute;'/learn/profile':typeof LearnProfileRoute;'/learn/register':typeof LearnRegisterRoute;'/learn/reset-password':typeof LearnResetPasswordRoute;'/learn/workshops':typeof LearnWorkshopsRoute;'/learn/':typeof LearnIndexRoute;'/learn/manage/courses':typeof LearnManageCoursesRoute;'/learn/manage/enrolments':typeof LearnManageEnrolmentsRoute;'/learn/manage/course-content/$courseId':typeof LearnManageCourseContentCourseIdRoute;'/learn/manage/course-students/$courseId':typeof LearnManageCourseStudentsCourseIdRoute;'/learn/manage/workshop-registrations':typeof LearnManageWorkshopRegistrationsRoute;'/learn/manage/workshops':typeof LearnManageWorkshopsRoute;'/learn/manage/chatrooms':typeof LearnManageChatroomsRoute;'/learn/manage/announcements':typeof LearnManageAnnouncementsRoute}
export interface FileRoutesByTo extends FileRoutesByFullPath {'/learn':typeof LearnIndexRoute}
export interface FileRoutesById extends FileRoutesByFullPath {'__root__':typeof rootRouteImport}
export interface FileRouteTypes {fileRoutesByFullPath:FileRoutesByFullPath;fullPaths:keyof FileRoutesByFullPath;fileRoutesByTo:keyof FileRoutesByTo;id:keyof FileRoutesById;fileRoutesById:FileRoutesById}
export interface RootRouteChildren {IndexRoute:typeof IndexRoute;LearnCoursesRoute:typeof LearnCoursesRoute;LearnCourseDetailRoute:typeof LearnCourseDetailRoute;LearnForgotPasswordRoute:typeof LearnForgotPasswordRoute;LearnHelpRoute:typeof LearnHelpRoute;LearnLoginRoute:typeof LearnLoginRoute;LearnMessagesRoute:typeof LearnMessagesRoute;LearnNotificationsRoute:typeof LearnNotificationsRoute;LearnProfileRoute:typeof LearnProfileRoute;LearnRegisterRoute:typeof LearnRegisterRoute;LearnResetPasswordRoute:typeof LearnResetPasswordRoute;LearnWorkshopsRoute:typeof LearnWorkshopsRoute;LearnIndexRoute:typeof LearnIndexRoute;LearnManageCoursesRoute:typeof LearnManageCoursesRoute;LearnManageEnrolmentsRoute:typeof LearnManageEnrolmentsRoute;LearnManageCourseContentCourseIdRoute:typeof LearnManageCourseContentCourseIdRoute;LearnManageCourseStudentsCourseIdRoute:typeof LearnManageCourseStudentsCourseIdRoute;LearnManageWorkshopRegistrationsRoute:typeof LearnManageWorkshopRegistrationsRoute;LearnManageWorkshopsRoute:typeof LearnManageWorkshopsRoute;LearnManageChatroomsRoute:typeof LearnManageChatroomsRoute;LearnManageAnnouncementsRoute:typeof LearnManageAnnouncementsRoute}
const rootRouteChildren={IndexRoute,LearnCoursesRoute,LearnCourseDetailRoute,LearnForgotPasswordRoute,LearnHelpRoute,LearnLoginRoute,LearnMessagesRoute,LearnNotificationsRoute,LearnProfileRoute,LearnRegisterRoute,LearnResetPasswordRoute,LearnWorkshopsRoute,LearnIndexRoute,LearnManageCoursesRoute,LearnManageEnrolmentsRoute,LearnManageCourseContentCourseIdRoute,LearnManageCourseStudentsCourseIdRoute,LearnManageWorkshopRegistrationsRoute,LearnManageWorkshopsRoute,LearnManageChatroomsRoute,LearnManageAnnouncementsRoute}
export const routeTree=rootRouteImport._addFileChildren(rootRouteChildren)._addFileTypes<FileRouteTypes>()

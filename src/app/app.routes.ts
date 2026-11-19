import { Routes } from '@angular/router';

import { SuggestionInsert } from './page/suggestion/suggestion-insert/suggestion-insert';
import { ComplaintInsert } from './page/complaint/complaint-insert/complaint-insert';
import { Home } from './page/home/home';
import { FollowUpView } from './page/follow-up/view/view';
import { AdminPanel } from './page/admin/panel/panel';
import { Register } from './page/register/register';
import { Login } from './page/login/login';
import { TaskPageComponent } from './page/task-page.component';

import { managerGuard } from './guard/manager.guard';

export const routes: Routes = [
    {
        path: '',
        component: Home
    },
    {
        path: 'tasks',
        component: TaskPageComponent
    },
    {
        path: 'suggestion/insert',
        component: SuggestionInsert
    },
    {
        path: 'complaint/insert',
        component: ComplaintInsert
    },
    {
        path: 'follow-up/view',
        component: FollowUpView
    },
    {
        path: 'admin',
        component: AdminPanel,
        canActivate: [managerGuard],
        data: {
            roles: ['ADMIN']
        }
    },
    {
        path: 'register',
        component: Register
    },
    {
        path: 'login',
        component: Login
    },
    {
        path: '**',
        redirectTo: ''
    }
];
import { createRouter, createWebHistory } from 'vue-router'
import MapView from '../views/MapView.vue'
import TeachView from '../views/TeachView.vue'
import LearnView from '../views/LearnView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/map' },
    { path: '/map', name: 'map', component: MapView },
    { path: '/teach', name: 'teach', component: TeachView },
    { path: '/learn', name: 'learn', component: LearnView },
  ],
})

export default router
import { createRouter, createMemoryHistory } from "vue-router";
import Login from "../components/LoginView.vue";
import SenderView from "../components/SenderView.vue";
import ReceiverView from "../components/ReceiverView.vue";

const router = createRouter({
    history: createMemoryHistory(),
    routes: [
        { path: "/", component: Login },
        { path: "/sender", component: SenderView },
        { path: "/receiver", component: ReceiverView },
    ],
});

export default router;

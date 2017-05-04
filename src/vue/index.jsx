import Vue from "vue";
import { mapState } from "vuex";

import store from "./store/index";
import router from "./router/index";

import "./components/modwatch-nav.jsx";

new Vue({
  el: "#modwatch-app",
  render(h) {
    return (
      <div>
        <header>
          <h1 id="header"><a href="/">MODWATCH</a></h1>
        </header>
        <modwatch-nav></modwatch-nav>
        <div class="content-wrapper">
          <article class="view-wrapper">
            <transition name="fade" mode="out-in">
              <router-view></router-view>
            </transition>
          </article>
        </div>
      </div>

    );
  },
  store,
  router,
  computed: {
    //...mapState()
  }
});
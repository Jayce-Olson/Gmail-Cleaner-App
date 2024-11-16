import Vue from "vue";
import Vuex from "vuex";
import createPersistedState from "vuex-persistedstate";

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    localUser: null,
    localPreview: "All emails with be deleted with the current settings",
  },
  mutations: {
    setLocalUser(state, user) {
      state.localUser = user;
    },
    clearLocalUser(state) {
      state.localUser = null;
    },
    setPreview(state, message) {
      state.localPreview = message;
    },
  },
  actions: {
    login({ commit }, user) {
      commit("setLocalUser", user);
    },
    logout({ commit }) {
      commit("clearLocalUser");
    },
  },
  plugins: [createPersistedState()], // Add the plugin here
});

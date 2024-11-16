<template>
  <div id="app">
    <HomePage :user="user" :emailPreview="emailPreview" />
  </div>
</template>

<script>
import HomePage from "./components/HomePage.vue";

export default {
  name: "App",
  components: {
    HomePage,
  },
  data() {
    return {
      user: null,
      emailPreview: "",
      buttonText: "Connect and Clean",
    };
  },
};
</script>

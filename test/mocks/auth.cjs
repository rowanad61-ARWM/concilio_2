const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_EMAIL = "round1-b1-audit-smoke@example.test";

async function auth() {
  return {
    user: {
      id: ACTOR_ID,
      email: ACTOR_EMAIL,
      name: "Round 1 B1 Smoke Actor",
    },
  };
}

module.exports = {
  auth,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
};

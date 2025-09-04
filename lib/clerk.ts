// Minimal Clerk client stub for development and testing environments
export const clerkClient = {
  users: {
    async getUserList(_: { emailAddress: string[] }) {
      return { data: [{ id: 'stub-user', publicMetadata: {} }] };
    },
    async updateUser(_: string, __: any) {
      return {};
    },
    async getUser(id: string) {
      return {
        id,
        firstName: 'User',
        emailAddresses: [{ emailAddress: 'user@example.com' }],
        publicMetadata: { premium_trial: null },
      };
    },
  },
};

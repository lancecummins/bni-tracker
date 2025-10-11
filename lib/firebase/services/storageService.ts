import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';

export const storageService = {
  // Upload team logo
  async uploadTeamLogo(teamId: string, file: File): Promise<string> {
    const fileExtension = file.name.split('.').pop();
    const fileName = `team-logos/${teamId}.${fileExtension}`;
    const storageRef = ref(storage, fileName);

    // Upload file
    await uploadBytes(storageRef, file);

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  },

  // Delete team logo
  async deleteTeamLogo(teamId: string, logoUrl: string): Promise<void> {
    try {
      // Extract file path from URL
      const url = new URL(logoUrl);
      const pathMatch = url.pathname.match(/\/o\/(.+?)\?/);
      if (pathMatch) {
        const filePath = decodeURIComponent(pathMatch[1]);
        const storageRef = ref(storage, filePath);
        await deleteObject(storageRef);
      }
    } catch (error) {
      console.error('Error deleting team logo:', error);
      // Don't throw - logo deletion is not critical
    }
  },

  // Upload user avatar
  async uploadUserAvatar(userId: string, file: File): Promise<string> {
    const fileExtension = file.name.split('.').pop();
    const fileName = `user-avatars/${userId}.${fileExtension}`;
    const storageRef = ref(storage, fileName);

    // Upload file
    await uploadBytes(storageRef, file);

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  },

  // Delete user avatar
  async deleteUserAvatar(userId: string, avatarUrl: string): Promise<void> {
    try {
      // Extract file path from URL
      const url = new URL(avatarUrl);
      const pathMatch = url.pathname.match(/\/o\/(.+?)\?/);
      if (pathMatch) {
        const filePath = decodeURIComponent(pathMatch[1]);
        const storageRef = ref(storage, filePath);
        await deleteObject(storageRef);
      }
    } catch (error) {
      console.error('Error deleting user avatar:', error);
      // Don't throw - avatar deletion is not critical
    }
  },
};

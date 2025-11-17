import * as idb from '../lib/idb.js';

export async function bookmarkStory(story) {
  try {
    await idb.idbPut('bookmarked-stories', story);
    return { success: true, message: 'Story berhasil di-bookmark!' };
  } catch (error) {
    console.error('Error bookmarking story:', error);
    return { success: false, message: 'Gagal bookmark story' };
  }
}

export async function unbookmarkStory(storyId) {
  try {
    await idb.idbDelete('bookmarked-stories', storyId);
    return { success: true, message: 'Bookmark berhasil dihapus!' };
  } catch (error) {
    console.error('Error unbookmarking story:', error);
    return { success: false, message: 'Gagal hapus bookmark' };
  }
}

export async function isStoryBookmarked(storyId) {
  try {
    const story = await idb.idbGet('bookmarked-stories', storyId);
    return !!story;
  } catch (error) {
    console.error('Error checking bookmark:', error);
    return false;
  }
}

export async function getBookmarkedStories() {
  try {
    return await idb.idbGetAll('bookmarked-stories');
  } catch (error) {
    console.error('Error getting bookmarked stories:', error);
    return [];
  }
}

export async function getBookmarkCount() {
  try {
    const stories = await idb.idbGetAll('bookmarked-stories');
    return stories.length;
  } catch (error) {
    console.error('Error getting bookmark count:', error);
    return 0;
  }
}

export async function queueOutbox(formDataObj, token) {
  try {
    await idb.idbAdd('outbox', {
      url: formDataObj.url,
      method: formDataObj.method || 'POST',
      fields: formDataObj.fields,
      token,
      createdAt: Date.now(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error queueing outbox:', error);
    return { success: false, error };
  }
}

export async function getOutbox() {
  try {
    return await idb.idbGetAll('outbox');
  } catch (error) {
    console.error('Error getting outbox:', error);
    return [];
  }
}

export async function deleteOutboxItem(key) {
  try {
    await idb.idbDelete('outbox', key);
    return { success: true };
  } catch (error) {
    console.error('Error deleting outbox item:', error);
    return { success: false, error };
  }
}
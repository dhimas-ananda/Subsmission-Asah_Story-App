import { idbAdd, idbGetAll, idbDelete } from '../lib/idb.js';

const API_BASE = 'https://story-api.dicoding.dev/v1';

function b64FromArrayBuffer(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function queueStoryForSync(formData, token) {
  console.log('📦 Queueing story for sync...');
  
  try {
    if (!formData || typeof formData.entries !== 'function') {
      throw new Error('Invalid FormData object');
    }

    const formDataFields = [];
    
    for (const pair of formData.entries()) {
      const [name, value] = pair;
      
      if (value instanceof File) {
        console.log(`📷 Processing file: ${value.name} (${value.size} bytes)`);
        const arrayBuffer = await value.arrayBuffer();
        const base64Data = b64FromArrayBuffer(arrayBuffer);
        
        formDataFields.push({
          kind: 'file',
          name,
          filename: value.name,
          type: value.type,
          data: base64Data
        });
        
        console.log(`✅ File encoded: ${base64Data.length} chars`);
      } else {
        console.log(`📝 Processing field: ${name} = ${value}`);
        formDataFields.push({
          kind: 'field',
          name,
          value: value.toString()
        });
      }
    }

    if (formDataFields.length === 0) {
      throw new Error('No data to queue - formDataFields is empty');
    }

    const outEntry = {
      cid: Date.now() + Math.random(),
      formDataFields,  
      token: token || null,
      createdAt: Date.now()
    };

    console.log('💾 Saving to IndexedDB outbox...');
    const cid = await idbAdd('outbox', outEntry);
    console.log(`✅ Saved to outbox with CID: ${cid}`);

    const allEntries = await idbGetAll('outbox');
    console.log(`📊 Total outbox entries: ${allEntries.length}`);

    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.sync.register('outbox-sync');
        console.log('✅ Background sync registered');
        return { queued: true, syncRegistered: true, cid };
      } catch (e) {
        console.warn('⚠️ Background sync registration failed:', e);
        const reg = await navigator.serviceWorker.ready;
        if (reg.active) {
          reg.active.postMessage('flush-outbox');
        }
        return { queued: true, syncRegistered: false, cid };
      }
    } else {
      console.warn('⚠️ Background Sync not supported');
      if (navigator.onLine) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.active) {
          reg.active.postMessage('flush-outbox');
        }
      }
      return { queued: true, syncRegistered: false, cid };
    }

  } catch (error) {
    console.error('❌ Error queueing story:', error);
    throw error;
  }
}

export async function flushOutboxFromClient() {
  console.log('📤 Flushing outbox from client...');
  
  try {
    const outEntries = await idbGetAll('outbox');
    console.log(`📦 Found ${outEntries.length} entries to sync`);

    if (outEntries.length === 0) {
      return { success: true, synced: 0 };
    }

    let successCount = 0;
    const errors = [];

    for (const entry of outEntries) {
      try {
        console.log(`🔄 Syncing entry CID: ${entry.cid}`);
        
        if (!entry.formDataFields || !Array.isArray(entry.formDataFields)) {
          console.error(`❌ Invalid entry CID ${entry.cid}: formDataFields is missing or not an array`);
          errors.push({ 
            cid: entry.cid, 
            error: 'formDataFields is undefined or not iterable' 
          });
          await idbDelete('outbox', entry.cid);
          continue;
        }

        if (entry.formDataFields.length === 0) {
          console.error(`❌ Invalid entry CID ${entry.cid}: formDataFields is empty`);
          errors.push({ 
            cid: entry.cid, 
            error: 'formDataFields is empty' 
          });
          await idbDelete('outbox', entry.cid);
          continue;
        }

        const fd = new FormData();

        for (const f of entry.formDataFields) {
          if (!f || !f.name) {
            console.warn(`⚠️ Skipping invalid field in CID ${entry.cid}`);
            continue;
          }

          if (f.kind === 'file') {
            console.log(`📷 Restoring file: ${f.filename}`);
            
            if (!f.data) {
              console.warn(`⚠️ File data missing for ${f.filename}`);
              continue;
            }

            try {
              const bytes = atob(f.data);
              const arr = new Uint8Array(bytes.length);
              for (let i = 0; i < bytes.length; i++) {
                arr[i] = bytes.charCodeAt(i);
              }
              const blob = new Blob([arr], { type: f.type || 'image/png' });
              fd.append(f.name, blob, f.filename || 'photo.png');
            } catch (decodeError) {
              console.error(`❌ Error decoding file ${f.filename}:`, decodeError);
              continue;
            }
          } else {
            console.log(`📝 Restoring field: ${f.name}`);
            fd.append(f.name, f.value || '');
          }
        }

        const headers = entry.token ? { Authorization: `Bearer ${entry.token}` } : {};

        console.log('🚀 Posting to API...');
        const resp = await fetch(`${API_BASE}/stories`, {
          method: 'POST',
          body: fd,
          headers
        });

        console.log(`📡 Response status: ${resp.status}`);

        const respClone = resp.clone();

        if (resp.ok) {
          await idbDelete('outbox', entry.cid);
          successCount++;
          console.log(`✅ Entry CID ${entry.cid} synced successfully`);
        } else {
          const errorText = await respClone.text();
          errors.push({ cid: entry.cid, error: errorText });
          console.error(`❌ Failed to sync CID ${entry.cid}:`, errorText);
        }

      } catch (e) {
        errors.push({ cid: entry.cid, error: e.message });
        console.error(`❌ Error syncing CID ${entry.cid}:`, e);
      }
    }

    console.log(`✅ Flush complete. Synced: ${successCount}, Failed: ${errors.length}`);

    return {
      success: errors.length === 0,
      synced: successCount,
      failed: errors.length,
      errors
    };

  } catch (error) {
    console.error('❌ Fatal error in flushOutboxFromClient:', error);
    return {
      success: false,
      synced: 0,
      failed: 0,
      errors: [{ error: error.message }]
    };
  }
}
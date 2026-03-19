import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AvatarIdentityPanel from './AvatarIdentityPanel.jsx'

describe('AvatarIdentityPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('Audio', class {
      pause() {}

      removeAttribute() {}

      load() {}
    })
  })

  it('keeps a saved mismatched voice hidden from Available voices', async () => {
    render(
      <AvatarIdentityPanel
        avatar={{
          id: 42,
          name: 'Aline',
          speechLanguage: 'fr-FR',
          ttsCredentialId: 7,
          ttsVoiceId: 'george',
        }}
        credentialId=""
        credentials={[]}
        ttsCredentials={[
          { id: 7, isActive: true, name: 'ElevenLabs', defaultModel: 'eleven_flash_v2_5' },
        ]}
        ttsVoicesByCredential={{
          7: [
            { id: 'george', name: 'George', language: 'English', gender: 'male' },
            { id: 'claire', name: 'Claire', language: 'French', gender: 'female' },
          ],
        }}
        onLoadTtsVoices={vi.fn().mockResolvedValue(undefined)}
        onSearchTtsVoiceLibrary={vi.fn().mockResolvedValue({ voices: [], nextPage: null })}
        onAddTtsVoiceLibraryVoice={vi.fn().mockResolvedValue(undefined)}
        onPreviewTts={vi.fn()}
        busy={false}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText(/1 shown \/ 1 matched \/ 2 loaded/i)).toBeInTheDocument()
    })

    expect(screen.getByText('Claire')).toBeInTheDocument()
    expect(
      screen.getByText(/The currently selected voice, George, does not match the avatar language or sex filters right now/i),
    ).toBeInTheDocument()
    expect(screen.queryByText('Selected for this avatar')).not.toBeInTheDocument()
  })
})

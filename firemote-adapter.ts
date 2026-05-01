export interface HomeAssistant {
  callService(domain: string, service: string, data: Record<string, any>): Promise<any> | void;
}

export interface RemoteCommandPayload {
  entity_id: string;
  command: string;
  num_repeats?: number;
  delay_secs?: number;
  hold_secs?: number;
  [key: string]: any;
}

export type AppLaunchTarget =
  | string
  | { adbCommand: string }
  | { remoteCommand: string | Omit<RemoteCommandPayload, 'entity_id'> };

export interface ControlOptions {
  deviceFamily?: string;
  deviceType?: string;
  remoteEntityId?: string;
  androidTvRemoteEntityId?: string;
  compatibilityMode?: 'strong' | 'weak' | string;
  eventListenerBinPath?: string;
  hasAtvAssociation?: boolean;
  isOn?: boolean;
}

export function sendCommand(
  hass: HomeAssistant,
  entityId: string,
  command: string,
  options: Partial<RemoteCommandPayload> = {}
) {
  const data: RemoteCommandPayload = {
    entity_id: entityId,
    command,
    ...options,
  };
  return hass.callService('remote', 'send_command', data);
}

function normalizeRemotePayload(
  payload: string | Omit<RemoteCommandPayload, 'entity_id'>
): Omit<RemoteCommandPayload, 'entity_id'> {
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as Omit<RemoteCommandPayload, 'entity_id'>;
    } catch {
      return { command: payload } as Omit<RemoteCommandPayload, 'entity_id'>;
    }
  }

  return payload;
}

export function launchApp(
  hass: HomeAssistant,
  entityId: string,
  appTarget: AppLaunchTarget
) {
  if (typeof appTarget === 'string') {
    return switchSource(hass, entityId, appTarget);
  }

  if ('remoteCommand' in appTarget) {
    const payload = normalizeRemotePayload(appTarget.remoteCommand);
    return hass.callService('remote', 'send_command', {
      entity_id: entityId,
      ...payload,
    });
  }

  if ('adbCommand' in appTarget) {
    return hass.callService('androidtv', 'adb_command', {
      entity_id: entityId,
      command: appTarget.adbCommand,
    });
  }

  return switchSource(hass, entityId, String(appTarget));
}

export function switchSource(
  hass: HomeAssistant,
  entityId: string,
  source: string
) {
  return hass.callService('media_player', 'select_source', {
    entity_id: entityId,
    source,
  });
}

export function togglePower(
  hass: HomeAssistant,
  entityId: string,
  options: ControlOptions = {}
) {
  const {
    deviceFamily,
    deviceType,
    androidTvRemoteEntityId,
    compatibilityMode,
    eventListenerBinPath,
    hasAtvAssociation,
    isOn,
  } = options;

  const normalizedEventListener = eventListenerBinPath ?? 'undefined';

  if (deviceFamily === 'apple-tv' || deviceFamily === 'roku') {
    return hass.callService(
      'media_player',
      isOn ? 'turn_off' : 'turn_on',
      { entity_id: entityId }
    );
  }

  if (hasAtvAssociation && androidTvRemoteEntityId) {
    return hass.callService('remote', 'send_command', {
      entity_id: androidTvRemoteEntityId,
      command: 'KEYCODE_POWER',
    });
  }

  if (compatibilityMode === 'strong' && normalizedEventListener === 'undefined') {
    return hass.callService('androidtv', 'adb_command', {
      entity_id: entityId,
      command: 'POWER',
    });
  }

  if (compatibilityMode === 'strong') {
    return hass.callService('media_player', 'toggle', {
      entity_id: entityId,
    });
  }

  if (
    [
      'fire_stick_4k',
      'fire_tv_stick_4k_max',
      'fire_tv_3rd_gen',
      'fire_stick_second_gen',
      'fire_tv_stick_4k_second_gen',
    ].includes(deviceType ?? '')
  ) {
    return hass.callService(
      'media_player',
      isOn ? 'turn_off' : 'turn_on',
      { entity_id: entityId }
    );
  }

  if (deviceType === 'fire_tv_cube_third_gen' && eventListenerBinPath) {
    return hass.callService('androidtv', 'adb_command', {
      entity_id: entityId,
      command:
        'sendevent ' +
        eventListenerBinPath +
        ' 1 116 1 && sendevent ' +
        eventListenerBinPath +
        ' 0 0 0 && sendevent ' +
        eventListenerBinPath +
        ' 1 116 0 && sendevent ' +
        eventListenerBinPath +
        ' 0 0 0 && sendevent /dev/input/event2 1 9 1 && sendevent /dev/input/event2 0 0 0 && sendevent /dev/input/event2 1 9 0 && sendevent /dev/input/event2 0 0 0',
    });
  }

  return hass.callService('androidtv', 'adb_command', {
    entity_id: entityId,
    command: 'POWER',
  });
}

export function setVolume(
  hass: HomeAssistant,
  entityId: string,
  level: number
) {
  return hass.callService('media_player', 'volume_set', {
    entity_id: entityId,
    volume_level: level,
  });
}

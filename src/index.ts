import {
  type VcsPlugin,
  type VcsUiApp,
  type PluginConfigEditor,
  type ButtonComponentOptions,
  type ButtonComponent,
  type WindowComponentOptions,
} from '@vcmap/ui';
import { CesiumMap, OpenlayersMap } from '@vcmap/core';
import { type WindowComponent } from '@vcmap/ui/src/manager/window/windowManager';
import { toLonLat } from 'ol/proj';
import type MapBrowserEvent from 'ol/MapBrowserEvent';
import {
  type ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Math,
  Cartographic,
} from '@vcmap-cesium/engine';
import { name, version, mapVersion } from '../package.json';
import Popup from './Popup.vue';

type PluginConfig = Record<never, never>;
type PluginState = Record<never, never>;

type MyPlugin = VcsPlugin<PluginConfig, PluginState>;

export default function plugin(
  config: PluginConfig,
  baseUrl: string,
): MyPlugin {
  // eslint-disable-next-line no-console
  console.log(config, baseUrl);

  //To store the current vcsUIApp (Not sure if best practice) 
  let vcsApp: VcsUiApp | null = null;
  //Stores the current button ID for the coordinate picker
  let buttonId: string | null = null;
  //Stores the current ID for the popup window with the coordinate information
  let popUpId: string | null = null;
  //Stores the coordinates passed into the popup window. The first pair are the X and Y of the projection, while the latter pair is for the longitude and latitude (in exactly this order)
  let coord = [0, 0, 0, 0];

  /**
   * Helper function to get the current active map as an object of the CesiumMap class.
   * @returns The active map as an instance of the Class CesiumMap, or null if the activeMap doesn't exist or is not of class CesiumMap
   */
  function getCesiumMap(): CesiumMap | null {
    if(vcsApp == null){
      return null;
    }
    const {activeMap} = vcsApp.maps;
    if (activeMap instanceof CesiumMap) {
      return activeMap;
    }
    return null;
  }

  /**
   * Helper function to get the current active map as an object of the OpenlayersMap class.
   * @returns The active map as an instance of the Class OpenlayersMap, or null if the activeMap doesn't exist or is not of class OpenlayersMap
   */
  function getOlMap(): OpenlayersMap | null {
    if(vcsApp == null){
      return null;
    }
    const {activeMap} = vcsApp.maps;
    if (activeMap instanceof OpenlayersMap) {
      return activeMap;
    }
    return null;
  }

  /**
   * Function that shows the PopUp Window. If one already exists, then it is removed and a new one is created in that position.
   * @returns void
   */
  function showPopUp(): void {
    let windowComponent: WindowComponent | null = null;
    let positionLeft: number | string | undefined;
    let positionTop: number | string | undefined;

    if(vcsApp == null){
      return;
    }
    //First check if popup Window already open. If open, then remove
    if (popUpId != null) {
      const currentWindow = vcsApp.windowManager.get(popUpId);
      if (currentWindow !== undefined && currentWindow !== null) {
        positionLeft = currentWindow.position.left;
        positionTop = currentWindow.position.top;
        vcsApp.windowManager.remove(popUpId);
      }
    }

    let currentProjectionCode: string | null = null;

    const ol = getOlMap();
    const cesium = getCesiumMap();
    //Get the current projection code
    if (ol != null) {
      const { olMap } = ol;
      if (olMap != null) {
        currentProjectionCode = olMap.getView().getProjection().getCode();
      }
    } else if (cesium != null) {
      //I think Cesium uses ECEF, not 100% sure.
      currentProjectionCode = 'ECEF';
    } else {
      return;
    }

    //_____________________________Pop Up Window____________________________________
    const wcOptions: WindowComponentOptions = {
      component: Popup,
      props: {
        message: 'The coordinates are: ',
        projectionCode: currentProjectionCode,
        coordinate: {
          x: coord[0],
          y: coord[1],
          lon: coord[2],
          lat: coord[3],
        },
      },
      state: {
        hidePin: true,
      },
      position: {
        left: positionLeft,
        top: positionTop,
        width: 600,
      },
    };
    
    windowComponent = vcsApp.windowManager.add(wcOptions, name);
    popUpId = windowComponent.id;
    
  }

  /**
   * Callback function for the OpenLayerMap click event.
   * @param event The event of type MapBrowserEvent. Stores information about the event.
   */
  function oLClickCallback(event: MapBrowserEvent): void {
    if(vcsApp == null){
      return;
    }

    if(buttonId == null){
      return;
    }
    
    const buttonComponent: ButtonComponent | undefined =
      vcsApp.navbarManager.get(buttonId);

    if(buttonComponent == null){
      return;
    }

    if (buttonComponent.action.active) {
      const lonlat = toLonLat(event.coordinate);
      coord = [
        event.coordinate[0],
        event.coordinate[1],
        lonlat[0],
        lonlat[1],
      ];
      showPopUp();
    }
  }

  /**
   * Callback function for the CesiumMap click event.
   * @param event The event of type ScreenSpaceEventHandler.PositionedEvent. Stores information about the event.
   */
  function cesiumClickCallback(
    event: ScreenSpaceEventHandler.PositionedEvent,
  ): void {
    if (vcsApp == null) {
      return;
    }

    const map = getCesiumMap();
    if (map == null) {
      return;
    }

    const scene = map.getScene();
    if (scene == null) {
      return;
    }

    if (buttonId == null) {
      return;
    }
    const buttonComponent: ButtonComponent | undefined =
      vcsApp.navbarManager.get(buttonId);
    if (buttonComponent == null) {
      return;
    }

    if (buttonComponent.action.active) {
      const cartesian = scene.pickPosition(event.position);
      if (cartesian == null) {
        return;
      }
      const cartographic = Cartographic.fromCartesian(cartesian);
      coord = [
        cartesian.x,
        cartesian.y,
        Math.toDegrees(cartographic.longitude),
        Math.toDegrees(cartographic.latitude),
      ];
      showPopUp();
    }
  }

  /**
   * Callback for the button that triggers the coordinate picker
   * @returns 
   */
  function coordinatePickerButtonClicked(): void {
    if (vcsApp == null) {
      return;
    }

    if (buttonId == null) {
      return;
    }
    const buttonComponent: ButtonComponent | undefined =
      vcsApp.navbarManager.get(buttonId);

    if (buttonComponent == null) {
      return;
    }

    //Toggle the active state
    buttonComponent.action.active = !buttonComponent.action.active; 

    const ol = getOlMap();
    const cesium = getCesiumMap();

    if (ol != null) {
      const { olMap } = ol;
      if (olMap == null) {
        return;
      }

      olMap.on('click', oLClickCallback);

      if (buttonComponent.action.active) {
        olMap.getViewport().style.cursor = 'crosshair';
      } else {
        olMap.getViewport().style.cursor = 'hand';
      }
    } else if (cesium != null) {
      const scene = cesium.getScene();
      if (scene == null) {
        return;
      }

      const { canvas } = scene;
      if (canvas == null) {
        return;
      }

      if (buttonComponent.action.active) {
        canvas.style.cursor = 'crosshair';
      } else {
        canvas.style.cursor = 'default';
      }

      cesium.screenSpaceEventHandler?.setInputAction(
        cesiumClickCallback,
        ScreenSpaceEventType.LEFT_CLICK,
      );
    }
  }

  return {
    get name(): string {
      return name;
    },
    get version(): string {
      return version;
    },
    get mapVersion(): string {
      return mapVersion;
    },
    initialize(vcsUiApp: VcsUiApp, state?: PluginState): Promise<void> {
      // eslint-disable-next-line no-console
      console.log(
        'Called before loading the rest of the current context. Passed in the containing Vcs UI App ',
        vcsUiApp,
        state,
      );
      return Promise.resolve();
    },

    onVcsAppMounted(vcsUiApp: VcsUiApp): void {
      // eslint-disable-next-line no-console
      console.log(
        'Called when the root UI component is mounted and managers are ready to accept components',
        vcsUiApp,
      );

      //set the vcsApp variable for future use
      vcsApp = vcsUiApp;

      //_____________________________Coordinate Picker Button____________________________________
      //Create the bcOptions for the Coordinate Picker button
      const bcOptions: ButtonComponentOptions = {
        weight: 100,
        action: {
          name,
          icon: '$vcsWand',
          active: false,
          callback: coordinatePickerButtonClicked,
        },
      };

      const buttonComponent: ButtonComponent = vcsUiApp.navbarManager.add(
        bcOptions,
        name,
        1,
      );

      //For future reference of the newly created button
      buttonId = buttonComponent.id;
    },

    /**
     * should return all default values of the configuration
     */
    getDefaultOptions(): PluginConfig {
      return {};
    },
    /**
     * should return the plugin's serialization excluding all default values
     */
    toJSON(): PluginConfig {
      // eslint-disable-next-line no-console
      console.log('Called when serializing this plugin instance');
      return {};
    },
    /**
     * should return the plugins state
     * @param {boolean} forUrl
     * @returns {PluginState}
     */
    getState(forUrl?: boolean): PluginState {
      // eslint-disable-next-line no-console
      console.log('Called when collecting state, e.g. for create link', forUrl);
      return {
        prop: '*',
      };
    },
    /**
     * components for configuring the plugin and/ or custom items defined by the plugin
     */
    getConfigEditors(): PluginConfigEditor<object>[] {
      return [];
    },
    destroy(): void {
      // eslint-disable-next-line no-console
      console.log('hook to cleanup');
    },
  };
}

/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import { useState, useEffect, useCallback } from "react";
import { AvaturnSDK, AssetItem, BodyItem } from "@avaturn/sdk";
import "./scene.css";

const disableUi = false;

const Scene = () => {
  //   const { log, clear } = useLogger();
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
  const [sdk] = useState<AvaturnSDK>(new AvaturnSDK());
  const [editorLoaded, setEditorLoaded] = useState(false);
  const [assetList, setAssetList] = useState<AssetItem[]>([]);
  const [bodyList, setBodyList] = useState<BodyItem[]>([]);

  useEffect(() => {
    if (!containerRef) return;
    // setEditorLoaded(false);

    sdk
      .init(containerRef, {
        // url: "https://odyssey.stream/session/new",
        iframeClassName: "sdk-iframe",
        disableUi,
      })
      .then(() => {
        sdk
          .on("load", () => {
            console.log("[callback] Page is ready");

            setEditorLoaded(true);
            sdk.getBodyList().then(setBodyList);
            sdk.getAssetList().then((list) => {
              //   const filteredList = list.slice(0, 3).map((x) => x.id);
              //   sdk.setAvailableAssets(filteredList);
              setAssetList(list);
            });

            // hint: You can use code similar to function `handleFilterAssets` here to load only selected assets
          })
          .on("assetSet", (data) => {
            console.log("[callback] Asset changed: " + data);
          })
          .on("bodySet", (data) => {
            console.log("[callback] Body changed: " + data);
          })
          .on("export", (data) => {
            console.log(
              "[callback] Avatar exported. Check dev console to explore returned value.",
            );
            console.log(data);
          })
          .on("changeParam", (data) => {
            console.log(`[callback] Set ${data.key} to ${data.value}`);
          });
      })
      .catch((reason) => {
        // sdk.getBodyList().then(setBodyList);
        // sdk.getAssetList().then((list) => setAssetList(list));
        console.log(`[Avaturn SDK Error]: ${reason}`);
      });

    return () => {
      sdk.destroy();
      setAssetList([]);
      setBodyList([]);
      //   clear();
    };
  }, [sdk, containerRef]);

  const handleSetAsset = (id: string) => {
    console.log(`Calling sdk.setActiveAsset('${id}')`);
    sdk.setActiveAsset(id).then((res) => {
      console.log("[then] Asset changed: " + res);
    });
  };

  const handleSetBody = (id: string) => {
    console.log(`Calling sdk.setActiveBody('${id}')`);
    sdk.setActiveBody(id).then((res) => {
      console.log("[then] Body changed: " + res);
    });
  };

  const handleChangeColor = useCallback(
    (color: string) => {
      sdk.setHairColor(color as `#${string}`);
    },
    [sdk],
  );

  const handleExportAvatar = () => {
    console.log(`Calling sdk.exportAvatar()`);
    sdk.exportAvatar().then((res) => {
      console.log(
        "[then] Avatar exported (see console logs for exported object)",
      );
      console.log(res);
    });
  };

  const handleFilterAssets = () => {
    sdk
      .getAssetList()
      .then((list) => {
        const filteredList = list.slice(0, 3).map((x) => x.id);
        return sdk.setAvailableAssets(filteredList);
      })
      .then(() => {
        sdk.getAssetList().then((list) => setAssetList(list));
      });
  };
  const handleGetAssetList = () => {
    sdk.getAssetList().then((list) => {
      console.log(JSON.stringify(list, null, 2));
    });
  };
  const handleGetBodyList = () => {
    sdk.getBodyList().then((list) => {
      console.log(JSON.stringify(list, null, 2));
    });
  };
  return (
    <div className="sdk">
      <div ref={setContainerRef} className="sdk__scene" />
      {/* {disableUi && (
        <div className="sdk__controls">
          <h3>My UI</h3>
          <div className="assets">
            {assetList.map((item) => (
              <div
                key={item.id}
                className="assets__item"
                onClick={() => handleSetAsset(item.id)}
              >
                <img src={item.preview} alt={item.id} />
              </div>
            ))}
          </div>
          <div className="assets">
            {bodyList.map((item) => (
              <div
                key={item.id}
                className="assets__item"
                onClick={() => handleSetBody(item.id)}
              >
                <img src={item.preview} alt={item.id} />
              </div>
            ))}
          </div>
          {disableUi && sdk && editorLoaded && (
            <>
              <h3>Actions</h3>
              <div className="actions">
                <button onClick={handleExportAvatar}>Export</button>
                <button onClick={handleGetAssetList}>Get asset list</button>
                <button onClick={handleGetBodyList}>Get body list</button>
                <button onClick={handleFilterAssets}>Filter assets</button>
              </div>
            </>
          )}
        </div>
      )} */}
      {/* {!disableUi && <LoggerOwn />} */}
    </div>
  );
};

export default Scene;

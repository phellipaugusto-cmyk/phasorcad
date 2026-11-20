import { ThreePhaseGroupView } from "./ThreePhaseGroupView";
import { getGroupByElementId, isInternalGroupConnection } from "../../core/threePhase";
import { getElementSize } from "./threePhaseLayout";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type {
  CircuitConnection,
} from "../../core/CircuitConnection";

import type {
  CircuitElement,
} from "../../core/CircuitElement";

import type {
  CircuitTerminal,
} from "../../core/CircuitTerminal";

import type {
  DragState,
} from "../../core/DragState";

import {
  getAnimationFrame,
} from "./circuitAnimation";

import {
  CircuitComponent,
} from "./CircuitComponent";

import { AnimateToggle } from "./AnimateToggle";
import { useAnimationClock } from "./animationClock";

import {
  CircuitConnectionsSvg,
} from "./CircuitConnectionsSvg";

import {
  CircuitStatusBar,
} from "./CircuitStatusBar";

import type {
  CanvasProps,
} from "./canvasTypes";

import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  ELEMENT_EDGE_GAP,
  GRID_SIZE,
  clampElementPosition,
  snapElementPosition,
  type CanvasSize,
} from "./circuitGeometry";

import {
  clampZoom,
  fitZoom,
  formatZoom,
  stepZoom,
  toLogical,
} from "./canvasZoom";

import {
  loadCanvasZoom,
  saveCanvasZoom,
} from "../../storage/uiPreferences";

import {
  convertEditValue,
  createConnectionId,
  getEditValue,
} from "./circuitValues";

export function Canvas({
  animationModel,
  frequency,
  setFrequency,
  setSourceVoltage,
  elements,
  setElements,
  connections,
  setConnections,
  selectedElementId,
  setSelectedElementId,
  selectedConnectionId,
  setSelectedConnectionId,
  editingElementId,
  setEditingElementId,
  onPulseSwitch,
}: CanvasProps) {
  /*
   * O Canvas ocupa toda a largura disponível e vai até o fim da
   * janela. O tamanho é medido e arredondado para a grade.
   */
  const containerRef =
    useRef<HTMLDivElement>(null);

  const [canvasSize, setCanvasSize] =
    useState<CanvasSize>({
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
    });

  /*
   * Zoom da exibição. O circuito e o roteador continuam em
   * coordenadas lógicas; o zoom só escala o desenho.
   */
  const [zoom, setZoomState] =
    useState(() =>
      clampZoom(loadCanvasZoom())
    );

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  /* Ponto do conteúdo que deve ficar sob o ponteiro após o zoom. */
  const zoomAnchorRef = useRef<{
    contentX: number;
    contentY: number;
    pointerX: number;
    pointerY: number;
  } | null>(null);

  function changeZoom(
    nextZoom: number,
    pointer?: { x: number; y: number }
  ) {
    const next = clampZoom(nextZoom);

    const container =
      containerRef.current;

    if (container) {
      const px =
        pointer?.x ??
        container.clientWidth / 2;

      const py =
        pointer?.y ??
        container.clientHeight / 2;

      zoomAnchorRef.current = {
        contentX:
          (container.scrollLeft + px) /
          zoomRef.current,
        contentY:
          (container.scrollTop + py) /
          zoomRef.current,
        pointerX: px,
        pointerY: py,
      };
    }

    setZoomState(next);
  }

  /* Pinça com dois dedos: zoom ancorado no ponto médio. */
  useEffect(() => {
    const container =
      containerRef.current;

    if (!container) {
      return;
    }

    let start: {
      distance: number;
      zoom: number;
    } | null = null;

    const measure = (
      event: TouchEvent
    ) => {
      const a = event.touches[0];
      const b = event.touches[1];

      return {
        distance: Math.hypot(
          a.clientX - b.clientX,
          a.clientY - b.clientY
        ),
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2,
      };
    };

    const onStart = (
      event: TouchEvent
    ) => {
      if (event.touches.length === 2) {
        setDragState(null);

        start = {
          distance:
            measure(event).distance,
          zoom: zoomRef.current,
        };
      }
    };

    const onMove = (
      event: TouchEvent
    ) => {
      if (
        event.touches.length !== 2 ||
        !start ||
        start.distance === 0
      ) {
        return;
      }

      event.preventDefault();

      const m = measure(event);
      const rect =
        container.getBoundingClientRect();

      changeZoom(
        start.zoom *
          (m.distance /
            start.distance),
        {
          x: m.x - rect.left,
          y: m.y - rect.top,
        }
      );
    };

    const onEnd = (
      event: TouchEvent
    ) => {
      if (event.touches.length < 2) {
        start = null;
      }
    };

    container.addEventListener(
      "touchstart",
      onStart,
      { passive: true }
    );
    container.addEventListener(
      "touchmove",
      onMove,
      { passive: false }
    );
    container.addEventListener(
      "touchend",
      onEnd
    );
    container.addEventListener(
      "touchcancel",
      onEnd
    );

    return () => {
      container.removeEventListener(
        "touchstart",
        onStart
      );
      container.removeEventListener(
        "touchmove",
        onMove
      );
      container.removeEventListener(
        "touchend",
        onEnd
      );
      container.removeEventListener(
        "touchcancel",
        onEnd
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveCanvasZoom(zoom);
  }, [zoom]);

  /*
   * Ctrl + roda do mouse (ou pinça do touchpad) dá zoom no
   * ponteiro. O listener é não passivo para poder impedir o
   * zoom da página inteira.
   */
  useEffect(() => {
    const container =
      containerRef.current;

    if (!container) {
      return;
    }

    function handleWheel(
      event: WheelEvent
    ) {
      if (!event.ctrlKey) {
        return;
      }

      event.preventDefault();

      const rect =
        container!.getBoundingClientRect();

      changeZoom(
        zoomRef.current *
          Math.exp(
            -event.deltaY * 0.0015
          ),
        {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }
      );
    }

    container.addEventListener(
      "wheel",
      handleWheel,
      { passive: false }
    );

    return () => {
      container.removeEventListener(
        "wheel",
        handleWheel
      );
    };
    // changeZoom só usa refs e setState estável.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Mantém o ponto ancorado no lugar depois que o tamanho muda. */
  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    const container = containerRef.current;

    if (!anchor || !container) {
      return;
    }

    container.scrollLeft =
      anchor.contentX * zoom -
      anchor.pointerX;

    container.scrollTop =
      anchor.contentY * zoom -
      anchor.pointerY;

    zoomAnchorRef.current = null;
  }, [zoom]);

  /* Relógio compartilhado com os gráficos de onda. */
  const { running: animate, phase } = useAnimationClock();


  const animationFrame =
    animate && animationModel
      ? getAnimationFrame(
          animationModel,
          phase
        )
      : null;

  /* O callback de medição lê os elementos por ref para não se recriar a cada arraste. */
  const elementsRef =
    useRef(elements);

  elementsRef.current = elements;

  const measureCanvas =
    useCallback(() => {
      const container =
        containerRef.current;

      if (!container) {
        return;
      }

      const top =
        container.getBoundingClientRect()
          .top;

      /* O Canvas nunca fica menor que o circuito desenhado. */
      const neededWidth =
        elementsRef.current.reduce(
          (maximum, element) =>
            Math.max(
              maximum,
              element.x + getElementSize(element).width +
                ELEMENT_EDGE_GAP
            ),
          0
        );

      const neededHeight =
        elementsRef.current.reduce(
          (maximum, element) =>
            Math.max(
              maximum,
              element.y + getElementSize(element).height +
                ELEMENT_EDGE_GAP
            ),
          0
        );

      const width = Math.max(
        CANVAS_WIDTH,
        Math.floor(
          container.clientWidth /
            zoomRef.current /
            GRID_SIZE
        ) * GRID_SIZE,
        Math.ceil(
          neededWidth / GRID_SIZE
        ) * GRID_SIZE
      );

      const height = Math.max(
        CANVAS_HEIGHT,
        Math.floor(
          (window.matchMedia("(max-width: 900px)").matches
            ? container.clientHeight
            : window.innerHeight -
              top -
              24) /
            zoomRef.current /
            GRID_SIZE
        ) * GRID_SIZE,
        Math.ceil(
          neededHeight / GRID_SIZE
        ) * GRID_SIZE
      );

      setCanvasSize((current) =>
        current.width === width &&
        current.height === height
          ? current
          : { width, height }
      );
    }, []);

  /* Sem lista de dependências: remede se algo acima mudou de altura. */
  useLayoutEffect(() => {
    measureCanvas();
  });

  useLayoutEffect(() => {
    const container =
      containerRef.current;

    const observer =
      new ResizeObserver(
        measureCanvas
      );

    if (container) {
      observer.observe(container);
    }

    window.addEventListener(
      "resize",
      measureCanvas
    );

    return () => {
      observer.disconnect();

      window.removeEventListener(
        "resize",
        measureCanvas
      );
    };
  }, [measureCanvas]);

  const [
    editingValue,
    setEditingValue,
  ] =
    useState("");

  const [
    dragState,
    setDragState,
  ] =
    useState<
      DragState | null
    >(
      null
    );

  const [
    selectedOriginTerminal,
    setSelectedOriginTerminal,
  ] =
    useState<
      CircuitTerminal | null
    >(
      null
    );

  const [
    terminalSelectionError,
    setTerminalSelectionError,
  ] =
    useState<
      string | null
    >(
      null
    );

  const [
    connectionMessage,
    setConnectionMessage,
  ] =
    useState<
      string | null
    >(
      null
    );

  /* Fios internos dos blocos trifásicos ficam por conta do desenho. */
  const groupByElementId = getGroupByElementId(elements);
  const visibleConnections =
    groupByElementId.size === 0
      ? connections
      : connections.filter(
          (connection) =>
            !isInternalGroupConnection(connection, groupByElementId)
        );

  const connectedTerminalIds =
    new Set<string>();

  visibleConnections.forEach(
    (connection) => {
      connectedTerminalIds.add(
        connection.fromTerminalId
      );

      connectedTerminalIds.add(
        connection.toTerminalId
      );
    }
  );

  function selectElement(
    elementId: string
  ) {
    setSelectedConnectionId(
      null
    );

    setSelectedElementId(
      elementId
    );
  }

  function selectConnection(
    event:
      React.MouseEvent<
        SVGPathElement
      >,
    connectionId: string
  ) {
    event.stopPropagation();

    setSelectedElementId(
      null
    );

    setEditingElementId(
      null
    );

    setSelectedConnectionId(
      connectionId
    );

    setSelectedOriginTerminal(
      null
    );

    setTerminalSelectionError(
      null
    );

    setConnectionMessage(
      null
    );
  }

  function saveElementValue(
    element: CircuitElement
  ) {
    const numericValue =
      Number(
        editingValue
      );

    if (
      Number.isNaN(
        numericValue
      )
    ) {
      setEditingElementId(
        null
      );

      return;
    }

    const convertedValue =
      convertEditValue(
        element,
        numericValue
      );

    setElements(
      elements.map(
        (item) =>
          item.id ===
          element.id
            ? {
                ...item,

                value:
                  convertedValue,
              }
            : item
      )
    );

    if (
      element.type ===
      "source"
    ) {
      setSourceVoltage(
        convertedValue
      );
    }

    setEditingElementId(
      null
    );
  }

  function startEditing(
    element: CircuitElement
  ) {
    selectElement(
      element.id
    );

    /* Impedância: R e X se editam nas propriedades. */
    if (element.type === "impedance") {
      return;
    }

    /* Duplo clique no interruptor liga/desliga em vez de editar. */
    if (element.type === "switch") {
      /* Contato de contator: o estado vem da bobina. */
      if (element.controlledBy) {
        return;
      }

      /* Botoeira: um toque (pressiona e solta). */
      if (element.momentary) {
        onPulseSwitch?.(element.id);
        return;
      }

      setElements(
        elements.map((item) =>
          item.id === element.id
            ? { ...item, closed: item.closed === false }
            : item
        )
      );

      return;
    }

    setEditingElementId(
      element.id
    );

    setEditingValue(
      String(
        getEditValue(
          element
        )
      )
    );
  }

  function startDrag(
    event:
      React.MouseEvent<
        HTMLDivElement
      >,
    element: CircuitElement
  ) {
    if (
      editingElementId ===
      element.id
    ) {
      return;
    }

    event.preventDefault();

    selectElement(
      element.id
    );

    setDragState({
      elementId:
        element.id,

      offsetX:
        toLogical(
          event.clientX,
          zoom
        ) - element.x,

      offsetY:
        toLogical(
          event.clientY,
          zoom
        ) - element.y,
    });
  }

  /* Ajusta o zoom para o circuito inteiro caber na área visível. */
  function fitCircuitToView() {
    const container =
      containerRef.current;

    if (!container || elements.length === 0) {
      return;
    }

    const contentWidth = Math.max(
      ...elements.map(
        (element) =>
          element.x + getElementSize(element).width +
          ELEMENT_EDGE_GAP
      )
    );

    const contentHeight = Math.max(
      ...elements.map(
        (element) =>
          element.y + getElementSize(element).height +
          ELEMENT_EDGE_GAP
      )
    );

    const available =
      window.innerHeight -
      container.getBoundingClientRect().top -
      24;

    changeZoom(
      fitZoom(
        contentWidth,
        contentHeight,
        container.clientWidth,
        available
      )
    );
  }

  /* Move o circuito inteiro para o centro do Canvas, alinhado à grade. */
  function centerCircuit() {
    if (elements.length === 0) {
      return;
    }

    const minX = Math.min(
      ...elements.map(
        (element) => element.x
      )
    );

    const maxX = Math.max(
      ...elements.map(
        (element) =>
          element.x + getElementSize(element).width
      )
    );

    const minY = Math.min(
      ...elements.map(
        (element) => element.y
      )
    );

    const maxY = Math.max(
      ...elements.map(
        (element) =>
          element.y + getElementSize(element).height
      )
    );

    const deltaX =
      Math.round(
        ((canvasSize.width -
          (maxX - minX)) /
          2 -
          minX) /
          GRID_SIZE
      ) * GRID_SIZE;

    const deltaY =
      Math.round(
        ((canvasSize.height -
          (maxY - minY)) /
          2 -
          minY) /
          GRID_SIZE
      ) * GRID_SIZE;

    setElements(
      elements.map((element) => {
        const position =
          clampElementPosition(
            element.x + deltaX,
            element.y + deltaY,
            canvasSize
          );

        return {
          ...element,
          x: position.x,
          y: position.y,
        };
      })
    );
  }

  function handleMouseMove(
    event:
      React.MouseEvent<
        HTMLDivElement
      >
  ) {
    if (!dragState) {
      return;
    }

    const position =
      clampElementPosition(
        toLogical(
          event.clientX,
          zoom
        ) - dragState.offsetX,

        toLogical(
          event.clientY,
          zoom
        ) - dragState.offsetY,

        canvasSize
      );

    setElements(
      elements.map(
        (element) =>
          element.id ===
          dragState.elementId
            ? {
                ...element,

                x:
                  position.x,

                y:
                  position.y,
              }
            : element
      )
    );
  }

  function stopDrag() {
    if (dragState) {
      setElements(
        elements.map(
          (element) => {
            if (
              element.id !==
              dragState.elementId
            ) {
              return element;
            }

            const position =
              snapElementPosition(
                element.x,
                element.y,
                canvasSize
              );

            return {
              ...element,

              x:
                position.x,

              y:
                position.y,
            };
          }
        )
      );
    }

    setDragState(
      null
    );
  }

  function clearTerminalSelection() {
    setSelectedOriginTerminal(
      null
    );

    setTerminalSelectionError(
      null
    );
  }

  function startNewTerminalSelection() {
    clearTerminalSelection();

    setConnectionMessage(
      null
    );
  }

  function connectionAlreadyExists(
    originTerminalId: string,
    destinationTerminalId: string
  ): boolean {
    return connections.some(
      (connection) => {
        const sameDirection =
          connection.fromTerminalId ===
            originTerminalId &&
          connection.toTerminalId ===
            destinationTerminalId;

        const reverseDirection =
          connection.fromTerminalId ===
            destinationTerminalId &&
          connection.toTerminalId ===
            originTerminalId;

        return (
          sameDirection ||
          reverseDirection
        );
      }
    );
  }

  function createConnection(
    originTerminal:
      CircuitTerminal,
    destinationTerminal:
      CircuitTerminal
  ) {
    if (
      connectionAlreadyExists(
        originTerminal.id,
        destinationTerminal.id
      )
    ) {
      setTerminalSelectionError(
        "Já existe uma conexão entre esses terminais."
      );

      return;
    }

    const newConnection:
      CircuitConnection = {
        id:
          createConnectionId(
            originTerminal.id,
            destinationTerminal.id
          ),

        fromTerminalId:
          originTerminal.id,

        toTerminalId:
          destinationTerminal.id,
      };

    setConnections([
      ...connections,
      newConnection,
    ]);

    setSelectedConnectionId(
      newConnection.id
    );

    setSelectedElementId(
      null
    );

    setConnectionMessage(
      `Conexão criada: ${originTerminal.id} → ${destinationTerminal.id}.`
    );

    setSelectedOriginTerminal(
      null
    );

    setTerminalSelectionError(
      null
    );
  }

  function selectTerminal(
    event:
      React.MouseEvent<
        HTMLButtonElement
      >,
    element: CircuitElement,
    terminal:
      CircuitTerminal | undefined
  ) {
    event.stopPropagation();

    if (!terminal) {
      return;
    }

    setSelectedConnectionId(
      null
    );

    setSelectedElementId(
      element.id
    );

    setEditingElementId(
      null
    );

    setTerminalSelectionError(
      null
    );

    setConnectionMessage(
      null
    );

    if (
      !selectedOriginTerminal
    ) {
      setSelectedOriginTerminal(
        terminal
      );

      return;
    }

    if (
      terminal.id ===
      selectedOriginTerminal.id
    ) {
      clearTerminalSelection();

      return;
    }

    if (
      terminal.elementId ===
      selectedOriginTerminal.elementId
    ) {
      setTerminalSelectionError(
        "Não é permitido conectar dois terminais do mesmo componente nesta etapa."
      );

      return;
    }

    createConnection(
      selectedOriginTerminal,
      terminal
    );
  }

  return (
    <div className="canvas-root">
      <h2 className="canvas-title" style={{ margin: "4px 0 8px" }}>
        Canvas do Circuito
      </h2>

      <div className="canvas-toolbar" style={{
          border:
            "1px solid #ccc",

          padding:
            "6px 10px",

          marginBottom:
            "8px",

          backgroundColor:
            "#f8f8f8",

          display: "flex",

          alignItems: "center",

          justifyContent:
            "center",

          flexWrap: "wrap",

          gap: "6px 20px",
        }}
      >
        <label className="canvas-freq" title="O valor da fonte é editado selecionando-a no Canvas.">
          <strong>
            Frequência:
          </strong>
          {" "}

          <input
            type="number"
            min="0.000001"
            value={
              frequency
            }
            onChange={(
              event
            ) =>
              setFrequency(
                Math.max(
                  Number(
                    event.target.value
                  ),
                  0.000001
                )
              )
            }
            style={{
              width:
                "80px",
            }}
          />

          {" "}
          Hz
        </label>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <button
            type="button"
            aria-label="Diminuir zoom"
            title="Diminuir zoom (Ctrl + roda do mouse)"
            onClick={() =>
              changeZoom(stepZoom(zoom, -1))
            }
          >
            −
          </button>

          <button
            type="button"
            aria-label="Zoom 100%"
            title="Voltar para 100%"
            onClick={() => changeZoom(1)}
            style={{ minWidth: "52px" }}
          >
            {formatZoom(zoom)}
          </button>

          <button
            type="button"
            aria-label="Aumentar zoom"
            title="Aumentar zoom (Ctrl + roda do mouse)"
            onClick={() =>
              changeZoom(stepZoom(zoom, 1))
            }
          >
            +
          </button>

          <button
            type="button"
            onClick={fitCircuitToView}
            disabled={
              elements.length === 0
            }
            title="Ajustar o zoom para o circuito caber na tela"
          >
            Ajustar
          </button>
        </span>

        <AnimateToggle title="Fios coloridos pela tensão instantânea (verde +, vermelho −) e pontos que andam com a corrente, em câmera lenta." />

        <button
          type="button"
          className="canvas-center-btn"
          onClick={centerCircuit}
          disabled={
            elements.length === 0
          }
        >
          Centralizar circuito
        </button>
      </div>

      <CircuitStatusBar
        error={
          terminalSelectionError
        }
        message={
          connectionMessage
        }
        selectedOriginTerminalId={
          selectedOriginTerminal?.id ??
          null
        }
        selectedConnectionId={
          selectedConnectionId
        }
        onCancel={
          clearTerminalSelection
        }
        onNewConnection={
          startNewTerminalSelection
        }
      />

      <div
        ref={containerRef}
        className="canvas-scroll"
        style={{ overflow: "auto" }}
      >
      <div
        style={{
          width:
            `${canvasSize.width * zoom}px`,
          height:
            `${canvasSize.height * zoom}px`,
        }}
      >
      <div
        style={{
          transform:
            `scale(${zoom})`,
          transformOrigin:
            "0 0",
          touchAction:
            "pan-x pan-y",
          width:
            `${canvasSize.width}px`,
          height:
            `${canvasSize.height}px`,
          border:
            "2px dashed gray",

          boxSizing:
            "border-box",

          position:
            "relative",

          overflow:
            "hidden",

          backgroundColor:
            "#ffffff",
        }}
        onPointerMove={
          handleMouseMove
        }
        onPointerUp={
          stopDrag
        }
        onPointerCancel={
          stopDrag
        }
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") {
            stopDrag();
          }
        }}
      >
        <CircuitConnectionsSvg
          connections={
            visibleConnections
          }
          elements={
            elements
          }
          selectedConnectionId={
            selectedConnectionId
          }
          canvasSize={canvasSize}
          terminalColors={
            animationFrame?.terminalColor
          }
          wireFlow={
            animationFrame?.wireFlow
          }
          onSelectConnection={
            selectConnection
          }
        />

        {elements.map(
          (element) => element.group ? (
            element.group.role === "A" ? (
              <ThreePhaseGroupView
                key={element.id}
                members={elements.filter(
                  (item) => item.group?.id === element.group?.id
                )}
                selectedElementId={selectedElementId}
                selectedOriginTerminalId={
                  selectedOriginTerminal?.id ?? null
                }
                connectedTerminalIds={connectedTerminalIds}
                onStartDrag={startDrag}
                onSelectElement={selectElement}
                onSelectTerminal={selectTerminal}
              />
            ) : null
          ) : (
            <CircuitComponent
              key={
                element.id
              }
              element={
                element
              }
              flow={
                animationFrame?.flow[
                  element.id
                ]
              }
              isSelected={
                selectedElementId ===
                element.id
              }
              isEditing={
                editingElementId ===
                element.id
              }
              editingValue={
                editingValue
              }
              selectedOriginTerminalId={
                selectedOriginTerminal?.id ??
                null
              }
              connectedTerminalIds={
                connectedTerminalIds
              }
              onStartDrag={
                startDrag
              }
              onSelectElement={
                selectElement
              }
              onStartEditing={
                startEditing
              }
              onEditingValueChange={
                setEditingValue
              }
              onSaveValue={
                saveElementValue
              }
              onCancelEditing={() =>
                setEditingElementId(
                  null
                )
              }
              onSelectTerminal={
                selectTerminal
              }
            />
          )
        )}
      </div>
      </div>
      </div>
    </div>
  );
}
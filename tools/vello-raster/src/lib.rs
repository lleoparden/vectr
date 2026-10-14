//! Renderer-comparison harness for issue #25: Vectr's frozen stress fixtures drawn
//! with `vello_cpu` — the same rasterizer VectorCraft uses — behind a raw C ABI so
//! the packaged Electron harness can measure it without wasm-bindgen tooling.
//!
//! This is measurement scaffolding, not product code. Geometry arrives once at
//! build time in scene space; each frame applies a view transform and re-draws the
//! whole scene, mirroring how the CanvasKit baseline repaints every frame.
//!
//! Recorded design facts for the comparison:
//! - No culling: every fixture node is inside the 1200×800 viewport, so culling
//!   could not change the result (VectorCraft's own bench reports drawn/culled).
//! - Single-threaded: `num_threads = 0`, because wasm threads require
//!   SharedArrayBuffer plus COOP/COEP isolation.
//! - SIMD is enabled at build time via `-C target-feature=+simd128`.

use vello_cpu::color::{AlphaColor, Srgb};
use vello_cpu::kurbo::{Affine, BezPath, Stroke};
use vello_cpu::{Level, Pixmap, RenderContext, RenderSettings, Resources};

/// One scene shape: a closed polyline in local space plus its paint and item
/// transform. The item transform is applied per frame, matching the CanvasKit
/// baseline's per-item translate/scale work.
struct Shape {
    /// Index into `points` of the first vertex (x, y pairs).
    start: u32,
    /// Number of vertices.
    count: u32,
    color: [f32; 4],
    stroke_width: f32,
    is_stroke: bool,
    item_x: f32,
    item_y: f32,
    item_scale: f32,
}

pub struct State {
    context: RenderContext,
    resources: Resources,
    target: Pixmap,
    points: Vec<f32>,
    shapes: Vec<Shape>,
    view: View,
    width: u16,
    height: u16,
}

/// View transform applied to every shape on top of its own item transform.
struct View {
    translate_x: f32,
    translate_y: f32,
    scale: f32,
}

fn rgba_to_color(rgba: u32) -> [f32; 4] {
    [
        ((rgba >> 24) & 0xff) as f32 / 255.0,
        ((rgba >> 16) & 0xff) as f32 / 255.0,
        ((rgba >> 8) & 0xff) as f32 / 255.0,
        (rgba & 0xff) as f32 / 255.0,
    ]
}

impl State {
    fn new(width: u16, height: u16) -> Self {
        let settings = RenderSettings {
            level: Level::new(),
            num_threads: 0,
        };
        Self {
            context: RenderContext::new_with(width, height, settings),
            resources: Resources::new(),
            target: Pixmap::new(width, height),
            points: Vec::new(),
            shapes: Vec::new(),
            view: View {
                translate_x: 0.0,
                translate_y: 0.0,
                scale: 1.0,
            },
            width,
            height,
        }
    }

    fn path_for(&self, shape: &Shape) -> BezPath {
        let mut path = BezPath::new();
        for index in 0..shape.count {
            let point = ((shape.start + index) * 2) as usize;
            let x = self.points[point] as f64;
            let y = self.points[point + 1] as f64;
            if index == 0 {
                path.move_to((x, y));
            } else {
                path.line_to((x, y));
            }
        }
        path.close_path();
        path
    }
}

/// Reserves `bytes` inside the module's linear memory for a one-time upload.
#[no_mangle]
pub extern "C" fn vc_alloc(bytes: usize) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(bytes);
    let pointer = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    pointer
}

#[no_mangle]
pub extern "C" fn vc_new(width: u16, height: u16) -> *mut State {
    Box::into_raw(Box::new(State::new(width, height)))
}

/// # Safety
/// `state` must come from [`vc_new`] and must not be used after this call.
#[no_mangle]
pub unsafe extern "C" fn vc_free(state: *mut State) {
    if !state.is_null() {
        drop(Box::from_raw(state));
    }
}

/// Copies the scene into the module once. `shapes` holds four u32 per shape:
/// start, count, rgba, is_stroke (0/1); `widths` holds one f32 per shape; and
/// `transforms` holds three f32 per shape: item x, item y, item scale.
///
/// # Safety
/// Every pointer must reference at least the stated number of elements.
#[no_mangle]
pub unsafe extern "C" fn vc_scene(
    state: *mut State,
    points: *const f32,
    point_count: usize,
    shapes: *const u32,
    shape_count: usize,
    widths: *const f32,
    transforms: *const f32,
) {
    let state = &mut *state;
    state.points = std::slice::from_raw_parts(points, point_count * 2).to_vec();
    state.shapes = (0..shape_count)
        .map(|index| {
            let descriptor = std::slice::from_raw_parts(shapes.add(index * 4), 4);
            let item = std::slice::from_raw_parts(transforms.add(index * 3), 3);
            Shape {
                start: descriptor[0],
                count: descriptor[1],
                color: rgba_to_color(descriptor[2]),
                stroke_width: *widths.add(index),
                is_stroke: descriptor[3] == 1,
                item_x: item[0],
                item_y: item[1],
                item_scale: item[2],
            }
        })
        .collect();
}

/// Drops the copied scene so the leak check can prove wasm-side release.
///
/// # Safety
/// `state` must be a live pointer produced by [`vc_new`].
#[no_mangle]
pub unsafe extern "C" fn vc_clear_scene(state: *mut State) {
    let state = &mut *state;
    state.points.clear();
    state.shapes.clear();
}

/// Number of shapes currently held by the module, used by the leak check.
///
/// # Safety
/// `state` must be a live pointer produced by [`vc_new`].
#[no_mangle]
pub unsafe extern "C" fn vc_shape_count(state: *mut State) -> usize {
    (*state).shapes.len()
}

/// Starts a frame: resets the context and applies the view transform.
///
/// # Safety
/// `state` must be a live pointer produced by [`vc_new`].
#[no_mangle]
pub unsafe extern "C" fn vc_begin(state: *mut State, translate_x: f32, translate_y: f32, scale: f32) {
    let state = &mut *state;
    state.context.reset();
    state.view = View {
        translate_x,
        translate_y,
        scale,
    };
}

/// Draws the whole copied scene with the current view transform, applying each
/// shape's own transform first, as the CanvasKit baseline does per item.
///
/// # Safety
/// `state` must be a live pointer produced by [`vc_new`].
#[no_mangle]
pub unsafe extern "C" fn vc_draw(state: *mut State) {
    let state = &mut *state;
    let view = View {
        translate_x: state.view.translate_x,
        translate_y: state.view.translate_y,
        scale: state.view.scale,
    };
    for shape in &state.shapes {
        let path = state.path_for(shape);
        let item = Affine::translate((shape.item_x as f64, shape.item_y as f64))
            * Affine::scale(shape.item_scale as f64);
        state.context.set_transform(
            Affine::translate((view.translate_x as f64, view.translate_y as f64))
                * Affine::scale(view.scale as f64)
                * item,
        );
        if shape.is_stroke {
            state.context.set_stroke(Stroke::new(shape.stroke_width as f64));
        }
        state.context.set_paint(AlphaColor::<Srgb>::new(shape.color));
        if shape.is_stroke {
            state.context.stroke_path(&path);
        } else {
            state.context.fill_path(&path);
        }
    }
}

/// Rasterizes the frame and returns a pointer to premultiplied RGBA8 pixels.
///
/// # Safety
/// `state` must be a live pointer produced by [`vc_new`].
#[no_mangle]
pub unsafe extern "C" fn vc_render(state: *mut State) -> *const u8 {
    let state = &mut *state;
    state.context.flush();
    state.context.render(&mut state.target, &mut state.resources);
    state.target.data().as_ptr() as *const u8
}

/// # Safety
/// `state` must be a live pointer produced by [`vc_new`].
#[no_mangle]
pub unsafe extern "C" fn vc_byte_len(state: *mut State) -> usize {
    // `data()` is a slice of 4-byte premultiplied RGBA pixels, so the byte length
    // is the element count times the pixel size.
    (*state)
        .target
        .data()
        .len()
        .saturating_mul(std::mem::size_of::<vello_cpu::color::PremulRgba8>())
}

/// # Safety
/// `state` must be a live pointer produced by [`vc_new`].
#[no_mangle]
pub unsafe extern "C" fn vc_width(state: *mut State) -> u32 {
    (*state).width as u32
}

/// # Safety
/// `state` must be a live pointer produced by [`vc_new`].
#[no_mangle]
pub unsafe extern "C" fn vc_height(state: *mut State) -> u32 {
    (*state).height as u32
}


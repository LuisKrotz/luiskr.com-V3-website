/* @ts-self-types="./luiskr_text_draw.d.ts" */
export class TextDraw {
  __destroy_into_raw() {
    const t = this.__wbg_ptr
    return ((this.__wbg_ptr = 0), f.unregister(this), t)
  }
  free() {
    const t = this.__destroy_into_raw()
    F.__wbg_textdraw_free(t, 0)
  }
  frame(t) {
    return 0 !== F.textdraw_frame(this.__wbg_ptr, t)
  }
  init(t, e) {
    try {
      const r = F.__wbindgen_add_to_stack_pointer(-16)
      F.textdraw_init(r, this.__wbg_ptr, b(t), b(e))
      var n = w().getInt32(r + 0, !0)
      if (w().getInt32(r + 4, !0)) throw R(n)
    } finally {
      F.__wbindgen_add_to_stack_pointer(16)
    }
  }
  constructor() {
    const t = F.textdraw_new()
    return ((this.__wbg_ptr = t), f.register(this, this.__wbg_ptr, this), this)
  }
  resize(t, e) {
    F.textdraw_resize(this.__wbg_ptr, t, e)
  }
  set_chars(t) {
    const e = (function (t) {
        const e = (0, F.__wbindgen_export)(4 * t.length, 4) >>> 0
        return (
          ((null !== m && 0 !== m.byteLength) || (m = new Float32Array(F.memory.buffer)), m).set(
            t,
            e / 4
          ),
          (z = t.length),
          e
        )
      })(t),
      n = z
    return F.textdraw_set_chars(this.__wbg_ptr, e, n) >>> 0
  }
  set_ink(t, e, n, r) {
    F.textdraw_set_ink(this.__wbg_ptr, t, e, n, r)
  }
  set_size(t, e) {
    F.textdraw_set_size(this.__wbg_ptr, t, e)
  }
  trigger() {
    F.textdraw_trigger(this.__wbg_ptr)
  }
  upload_atlas(t) {
    try {
      return (
        0 !==
        F.textdraw_upload_atlas(
          this.__wbg_ptr,
          (function (t) {
            if (1 == T) throw new Error('out of js stack')
            return ((O[--T] = t), T)
          })(t)
        )
      )
    } finally {
      O[T++] = void 0
    }
  }
}
function t() {
  const t = {
    __proto__: null,
    __wbg___wbindgen_debug_string_4687d8d8c2017d52: function (t, e) {
      const n = (function (t, e, n) {
          if (void 0 === n) {
            const n = I.encode(t),
              r = e(n.length, 1) >>> 0
            return (
              y()
                .subarray(r, r + n.length)
                .set(n),
              (z = n.length),
              r
            )
          }
          let r = t.length,
            _ = e(r, 1) >>> 0
          const o = y()
          let c = 0
          for (; c < r; c++) {
            const e = t.charCodeAt(c)
            if (e > 127) break
            o[_ + c] = e
          }
          if (c !== r) {
            ;(0 !== c && (t = t.slice(c)), (_ = n(_, r, (r = c + 3 * t.length), 1) >>> 0))
            const e = y().subarray(_ + c, _ + r)
            ;((c += I.encodeInto(t, e).written), (_ = n(_, r, c, 1) >>> 0))
          }
          return ((z = c), _)
        })(g(x(e)), F.__wbindgen_export, F.__wbindgen_export2),
        r = z
      ;(w().setInt32(t + 4, r, !0), w().setInt32(t + 0, n, !0))
    },
    __wbg___wbindgen_is_null_e343b7d08827ba72: function (t) {
      return null === x(t)
    },
    __wbg___wbindgen_is_undefined_8865fb403f8fe9d8: function (t) {
      return void 0 === x(t)
    },
    __wbg___wbindgen_throw_41e9ee4f547fc59a: function (t, e) {
      throw new Error(p(t, e))
    },
    __wbg_beginRenderPass_46bc75d13eaf7381: function () {
      return v(function (t, e) {
        return b(x(t).beginRenderPass(x(e)))
      }, arguments)
    },
    __wbg_configure_a4e26031ba2da6a2: function () {
      return v(function (t, e) {
        x(t).configure(x(e))
      }, arguments)
    },
    __wbg_copyExternalImageToTexture_91a2b84d7d19190c: function () {
      return v(function (t, e, n, r) {
        x(t).copyExternalImageToTexture(x(e), x(n), x(r))
      }, arguments)
    },
    __wbg_createBindGroupLayout_dd6a685e68699be9: function () {
      return v(function (t, e) {
        return b(x(t).createBindGroupLayout(x(e)))
      }, arguments)
    },
    __wbg_createBindGroup_297f726263493b7a: function (t, e) {
      return b(x(t).createBindGroup(x(e)))
    },
    __wbg_createBuffer_7d58b37b7042f31f: function () {
      return v(function (t, e) {
        return b(x(t).createBuffer(x(e)))
      }, arguments)
    },
    __wbg_createCommandEncoder_d26cb1fdb68219f7: function (t, e) {
      return b(x(t).createCommandEncoder(x(e)))
    },
    __wbg_createPipelineLayout_39a9a7f694e28389: function (t, e) {
      return b(x(t).createPipelineLayout(x(e)))
    },
    __wbg_createRenderPipeline_e7c57f75917917e4: function () {
      return v(function (t, e) {
        return b(x(t).createRenderPipeline(x(e)))
      }, arguments)
    },
    __wbg_createSampler_1271407d57de5444: function (t, e) {
      return b(x(t).createSampler(x(e)))
    },
    __wbg_createShaderModule_274373c4cacce3a0: function (t, e) {
      return b(x(t).createShaderModule(x(e)))
    },
    __wbg_createTexture_272b1f1151792884: function () {
      return v(function (t, e) {
        return b(x(t).createTexture(x(e)))
      }, arguments)
    },
    __wbg_createView_7520397d720e9d7d: function () {
      return v(function (t) {
        return b(x(t).createView())
      }, arguments)
    },
    __wbg_draw_889697bdf4cad1b7: function (t, e, n) {
      x(t).draw(e >>> 0, n >>> 0)
    },
    __wbg_end_a97f51ac1f092bfe: function (t) {
      x(t).end()
    },
    __wbg_finish_489db1750712613c: function (t) {
      return b(x(t).finish())
    },
    __wbg_getContext_635e36719cad2623: function () {
      return v(function (t, e, n) {
        const r = x(t).getContext(p(e, n))
        return S(r) ? 0 : b(r)
      }, arguments)
    },
    __wbg_getCurrentTexture_f9b3ddbfb8575837: function () {
      return v(function (t) {
        return b(x(t).getCurrentTexture())
      }, arguments)
    },
    __wbg_getPreferredCanvasFormat_4d28b652aa67cc74: function (t) {
      const e = x(t).getPreferredCanvasFormat()
      return (s.indexOf(e) + 1 || 102) - 1
    },
    __wbg_get_31af05bd4842a84f: function () {
      return v(function (t, e) {
        return b(Reflect.get(x(t), x(e)))
      }, arguments)
    },
    __wbg_height_9dca4d43c3e4b84b: function (t) {
      return x(t).height
    },
    __wbg_new_617a8cdb8bb1130e: function () {
      return b(new Object())
    },
    __wbg_queue_17ba8833afbd540b: function (t) {
      return b(x(t).queue)
    },
    __wbg_setBindGroup_4af09961dd6fd6d4: function (t, e, n) {
      x(t).setBindGroup(e >>> 0, x(n))
    },
    __wbg_setPipeline_9870f87d9e0a49ab: function (t, e) {
      x(t).setPipeline(x(e))
    },
    __wbg_setScissorRect_78603d18fd6477a3: function (t, e, n, r, _) {
      x(t).setScissorRect(e >>> 0, n >>> 0, r >>> 0, _ >>> 0)
    },
    __wbg_set_a_d2dae9a62946ba86: function (t, e) {
      x(t).a = e
    },
    __wbg_set_address_mode_u_38bbe83e7cb70867: function (t, n) {
      x(t).addressModeU = e[n]
    },
    __wbg_set_address_mode_v_e4dc81ae95d4e2d1: function (t, n) {
      x(t).addressModeV = e[n]
    },
    __wbg_set_alpha_b14827cf8b4ac26a: function (t, e) {
      x(t).alpha = x(e)
    },
    __wbg_set_alpha_mode_16c3966c224ad4a9: function (t, e) {
      x(t).alphaMode = o[e]
    },
    __wbg_set_b_670dfc0631dcb9c1: function (t, e) {
      x(t).b = e
    },
    __wbg_set_bind_group_layouts_60a4869809302d79: function (t, e, n) {
      x(t).bindGroupLayouts = d(e, n)
    },
    __wbg_set_binding_1d51e1a2d1c0cdaf: function (t, e) {
      x(t).binding = e >>> 0
    },
    __wbg_set_binding_348f002e688081ac: function (t, e) {
      x(t).binding = e >>> 0
    },
    __wbg_set_blend_3f83603fc878c51d: function (t, e) {
      x(t).blend = x(e)
    },
    __wbg_set_buffer_22331adbf81699d2: function (t, e) {
      x(t).buffer = x(e)
    },
    __wbg_set_buffer_b8d40a54af365605: function (t, e) {
      x(t).buffer = x(e)
    },
    __wbg_set_clear_value_gpu_color_dict_c17321221601e286: function (t, e) {
      x(t).clearValue = x(e)
    },
    __wbg_set_code_4510e93549b3066e: function (t, e, n) {
      x(t).code = p(e, n)
    },
    __wbg_set_color_14d2fdcfc7117305: function (t, e) {
      x(t).color = x(e)
    },
    __wbg_set_color_attachments_367a5baf85bca057: function (t, e, n) {
      x(t).colorAttachments = d(e, n)
    },
    __wbg_set_device_53f6c9076263d322: function (t, e) {
      x(t).device = x(e)
    },
    __wbg_set_dst_factor_cfb1cd4ae3e673d9: function (t, e) {
      x(t).dstFactor = n[e]
    },
    __wbg_set_entries_7c51a3643c761ecf: function (t, e, n) {
      x(t).entries = d(e, n)
    },
    __wbg_set_entries_cc80db0de96ea4ff: function (t, e, n) {
      x(t).entries = d(e, n)
    },
    __wbg_set_entry_point_a7593f073d0352f7: function (t, e, n) {
      x(t).entryPoint = p(e, n)
    },
    __wbg_set_entry_point_edfb9dd004493bc8: function (t, e, n) {
      x(t).entryPoint = p(e, n)
    },
    __wbg_set_format_036434fd3db220e7: function (t, e) {
      x(t).format = s[e]
    },
    __wbg_set_format_6bbbd4df6747733e: function (t, e) {
      x(t).format = s[e]
    },
    __wbg_set_format_d4c8ef73b087dab0: function (t, e) {
      x(t).format = s[e]
    },
    __wbg_set_fragment_9bc5cc98c7c59fef: function (t, e) {
      x(t).fragment = x(e)
    },
    __wbg_set_g_ac69babc4a0b2338: function (t, e) {
      x(t).g = e
    },
    __wbg_set_has_dynamic_offset_e2a0bd85eaf36f34: function (t, e) {
      x(t).hasDynamicOffset = 0 !== e
    },
    __wbg_set_height_3879aafd24f118f9: function (t, e) {
      x(t).height = e >>> 0
    },
    __wbg_set_layout_4e86f7c1671a06d0: function (t, e) {
      x(t).layout = x(e)
    },
    __wbg_set_layout_f2b50454b73e9111: function (t, e) {
      x(t).layout = x(e)
    },
    __wbg_set_load_op_18ff54287ff40151: function (t, e) {
      x(t).loadOp = a[e]
    },
    __wbg_set_mag_filter_91c348b29e1a6e57: function (t, e) {
      x(t).magFilter = c[e]
    },
    __wbg_set_min_filter_fdbe96994784b13c: function (t, e) {
      x(t).minFilter = c[e]
    },
    __wbg_set_module_168054323d22d57d: function (t, e) {
      x(t).module = x(e)
    },
    __wbg_set_module_1ad4e7343951303d: function (t, e) {
      x(t).module = x(e)
    },
    __wbg_set_operation_d8894b0f9aa3db27: function (t, e) {
      x(t).operation = r[e]
    },
    __wbg_set_r_ccf9fe3e4d993555: function (t, e) {
      x(t).r = e
    },
    __wbg_set_resource_3367d3d5c5114a05: function (t, e) {
      x(t).resource = x(e)
    },
    __wbg_set_resource_gpu_buffer_binding_c689b0dc9379a99b: function (t, e) {
      x(t).resource = x(e)
    },
    __wbg_set_resource_gpu_texture_view_2ed0c241a5831597: function (t, e) {
      x(t).resource = x(e)
    },
    __wbg_set_sampler_e7e837391d5b7c70: function (t, e) {
      x(t).sampler = x(e)
    },
    __wbg_set_size_4716cf40ee7a64be: function (t, e) {
      x(t).size = e >>> 0
    },
    __wbg_set_size_c2eb75980b76e0ac: function (t, e, n) {
      x(t).size = d(e, n)
    },
    __wbg_set_source_3ffc7e2ebf9b8967: function (t, e) {
      x(t).source = x(e)
    },
    __wbg_set_src_factor_b29ea819b1b5d6f6: function (t, e) {
      x(t).srcFactor = n[e]
    },
    __wbg_set_store_op_6d2fb6cc3e66341e: function (t, e) {
      x(t).storeOp = u[e]
    },
    __wbg_set_targets_0328c60fcfc0f564: function (t, e, n) {
      x(t).targets = d(e, n)
    },
    __wbg_set_texture_5e4b2303dfbef0fa: function (t, e) {
      x(t).texture = x(e)
    },
    __wbg_set_texture_9f67e0e92f7c2af3: function (t, e) {
      x(t).texture = x(e)
    },
    __wbg_set_type_8e9e3a274f528f3e: function (t, e) {
      x(t).type = i[e]
    },
    __wbg_set_type_ff9e8f3110ad0cbf: function (t, e) {
      x(t).type = _[e]
    },
    __wbg_set_usage_7177d2b5a0cb7ed1: function (t, e) {
      x(t).usage = e >>> 0
    },
    __wbg_set_usage_aad5221dc614bcd1: function (t, e) {
      x(t).usage = e >>> 0
    },
    __wbg_set_usage_e842e619c53799e7: function (t, e) {
      x(t).usage = e >>> 0
    },
    __wbg_set_vertex_5b13839ffaff5f37: function (t, e) {
      x(t).vertex = x(e)
    },
    __wbg_set_view_gpu_texture_view_9f7613e516713508: function (t, e) {
      x(t).view = x(e)
    },
    __wbg_set_visibility_78cfb96740c9deb5: function (t, e) {
      x(t).visibility = e >>> 0
    },
    __wbg_set_width_4aa921b5f44a4f8b: function (t, e) {
      x(t).width = e >>> 0
    },
    __wbg_static_accessor_GLOBAL_266715b9d96ba635: function () {
      const t = 'undefined' == typeof global ? null : global
      return S(t) ? 0 : b(t)
    },
    __wbg_static_accessor_GLOBAL_THIS_10fb7dc1ae063179: function () {
      const t = 'undefined' == typeof globalThis ? null : globalThis
      return S(t) ? 0 : b(t)
    },
    __wbg_static_accessor_SELF_0b583911f537483a: function () {
      const t = 'undefined' == typeof self ? null : self
      return S(t) ? 0 : b(t)
    },
    __wbg_static_accessor_WINDOW_d7f903d1508cbdc4: function () {
      const t = 'undefined' == typeof window ? null : window
      return S(t) ? 0 : b(t)
    },
    __wbg_submit_46ecaa46ea244579: function (t, e, n) {
      x(t).submit(d(e, n))
    },
    __wbg_width_8a9cc26363f10d5f: function (t) {
      return x(t).width
    },
    __wbg_writeBuffer_2c02702ce0fa25c3: function () {
      return v(function (t, e, n, r, _) {
        var o, c
        x(t).writeBuffer(
          x(e),
          n >>> 0,
          ((o = r), (c = _), (o >>>= 0), y().subarray(o / 1, o / 1 + c))
        )
      }, arguments)
    },
    __wbindgen_generic_0000000000000001: function (t) {
      return b(t)
    },
    __wbindgen_generic_0000000000000002: function (t, e) {
      return b(p(t, e))
    },
    __wbindgen_object_clone_ref: function (t) {
      return b(x(t))
    },
    __wbindgen_object_drop_ref: function (t) {
      R(t)
    },
  }
  return { __proto__: null, './luiskr_text_draw_bg.js': t }
}
Symbol.dispose && (TextDraw.prototype[Symbol.dispose] = TextDraw.prototype.free)
const e = ['clamp-to-edge', 'repeat', 'mirror-repeat'],
  n = [
    'zero',
    'one',
    'src',
    'one-minus-src',
    'src-alpha',
    'one-minus-src-alpha',
    'dst',
    'one-minus-dst',
    'dst-alpha',
    'one-minus-dst-alpha',
    'src-alpha-saturated',
    'constant',
    'one-minus-constant',
    'src1',
    'one-minus-src1',
    'src1-alpha',
    'one-minus-src1-alpha',
  ],
  r = ['add', 'subtract', 'reverse-subtract', 'min', 'max'],
  _ = ['uniform', 'storage', 'read-only-storage'],
  o = ['opaque', 'premultiplied'],
  c = ['nearest', 'linear'],
  a = ['load', 'clear'],
  i = ['filtering', 'non-filtering', 'comparison'],
  u = ['store', 'discard'],
  s = [
    'r8unorm',
    'r8snorm',
    'r8uint',
    'r8sint',
    'r16unorm',
    'r16snorm',
    'r16uint',
    'r16sint',
    'r16float',
    'rg8unorm',
    'rg8snorm',
    'rg8uint',
    'rg8sint',
    'r32uint',
    'r32sint',
    'r32float',
    'rg16unorm',
    'rg16snorm',
    'rg16uint',
    'rg16sint',
    'rg16float',
    'rgba8unorm',
    'rgba8unorm-srgb',
    'rgba8snorm',
    'rgba8uint',
    'rgba8sint',
    'bgra8unorm',
    'bgra8unorm-srgb',
    'rgb9e5ufloat',
    'rgb10a2uint',
    'rgb10a2unorm',
    'rg11b10ufloat',
    'rg32uint',
    'rg32sint',
    'rg32float',
    'rgba16unorm',
    'rgba16snorm',
    'rgba16uint',
    'rgba16sint',
    'rgba16float',
    'rgba32uint',
    'rgba32sint',
    'rgba32float',
    'stencil8',
    'depth16unorm',
    'depth24plus',
    'depth24plus-stencil8',
    'depth32float',
    'depth32float-stencil8',
    'bc1-rgba-unorm',
    'bc1-rgba-unorm-srgb',
    'bc2-rgba-unorm',
    'bc2-rgba-unorm-srgb',
    'bc3-rgba-unorm',
    'bc3-rgba-unorm-srgb',
    'bc4-r-unorm',
    'bc4-r-snorm',
    'bc5-rg-unorm',
    'bc5-rg-snorm',
    'bc6h-rgb-ufloat',
    'bc6h-rgb-float',
    'bc7-rgba-unorm',
    'bc7-rgba-unorm-srgb',
    'etc2-rgb8unorm',
    'etc2-rgb8unorm-srgb',
    'etc2-rgb8a1unorm',
    'etc2-rgb8a1unorm-srgb',
    'etc2-rgba8unorm',
    'etc2-rgba8unorm-srgb',
    'eac-r11unorm',
    'eac-r11snorm',
    'eac-rg11unorm',
    'eac-rg11snorm',
    'astc-4x4-unorm',
    'astc-4x4-unorm-srgb',
    'astc-5x4-unorm',
    'astc-5x4-unorm-srgb',
    'astc-5x5-unorm',
    'astc-5x5-unorm-srgb',
    'astc-6x5-unorm',
    'astc-6x5-unorm-srgb',
    'astc-6x6-unorm',
    'astc-6x6-unorm-srgb',
    'astc-8x5-unorm',
    'astc-8x5-unorm-srgb',
    'astc-8x6-unorm',
    'astc-8x6-unorm-srgb',
    'astc-8x8-unorm',
    'astc-8x8-unorm-srgb',
    'astc-10x5-unorm',
    'astc-10x5-unorm-srgb',
    'astc-10x6-unorm',
    'astc-10x6-unorm-srgb',
    'astc-10x8-unorm',
    'astc-10x8-unorm-srgb',
    'astc-10x10-unorm',
    'astc-10x10-unorm-srgb',
    'astc-12x10-unorm',
    'astc-12x10-unorm-srgb',
    'astc-12x12-unorm',
    'astc-12x12-unorm-srgb',
  ],
  f =
    'undefined' == typeof FinalizationRegistry
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry((t) => F.__wbg_textdraw_free(t, 1))
function b(t) {
  A === O.length && O.push(O.length + 1)
  const e = A
  return ((A = O[e]), (O[e] = t), e)
}
function g(t) {
  const e = typeof t
  if ('number' == e || 'boolean' == e || null == t) return `${t}`
  if ('string' == e) return `"${t}"`
  if ('symbol' == e) {
    const e = t.description
    return null == e ? 'Symbol' : `Symbol(${e})`
  }
  if ('function' == e) {
    const e = t.name
    return 'string' == typeof e && e.length > 0 ? `Function(${e})` : 'Function'
  }
  if (Array.isArray(t)) {
    const e = t.length
    let n = '['
    e > 0 && (n += g(t[0]))
    for (let r = 1; r < e; r++) n += ', ' + g(t[r])
    return ((n += ']'), n)
  }
  const n = /\[object ([^\]]+)\]/.exec(toString.call(t))
  let r
  if (!(n && n.length > 1)) return toString.call(t)
  if (((r = n[1]), 'Object' == r))
    try {
      return 'Object(' + JSON.stringify(t) + ')'
    } catch (t) {
      return 'Object'
    }
  return t instanceof Error ? `${t.name}: ${t.message}\n${t.stack}` : r
}
function d(t, e) {
  t >>>= 0
  const n = w(),
    r = []
  for (let _ = t; _ < t + 4 * e; _ += 4) r.push(x(n.getUint32(_, !0)))
  return r
}
let l = null
function w() {
  return (
    (null === l ||
      !0 === l.buffer.detached ||
      (void 0 === l.buffer.detached && l.buffer !== F.memory.buffer)) &&
      (l = new DataView(F.memory.buffer)),
    l
  )
}
let m = null
function p(t, e) {
  return (function (t, e) {
    return (
      (L += e),
      L >= B && ((j = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })), j.decode(), (L = e)),
      j.decode(y().subarray(t, t + e))
    )
  })(t >>> 0, e)
}
let h = null
function y() {
  return ((null !== h && 0 !== h.byteLength) || (h = new Uint8Array(F.memory.buffer)), h)
}
function x(t) {
  return O[t]
}
function v(t, e) {
  try {
    return t.apply(this, e)
  } catch (t) {
    F.__wbindgen_export3(b(t))
  }
}
let O = new Array(1024).fill(void 0)
O.push(void 0, null, !0, !1)
let A = O.length
function S(t) {
  return null == t
}
let T = 1024
function R(t) {
  const e = x(t)
  return (
    (function (t) {
      t < 1028 || ((O[t] = A), (A = t))
    })(t),
    e
  )
}
let j = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })
j.decode()
const B = 2146435072
let L = 0
const I = new TextEncoder()
'encodeInto' in I ||
  (I.encodeInto = function (t, e) {
    const n = I.encode(t)
    return (e.set(n), { read: t.length, written: n.length })
  })
let P,
  W,
  F,
  z = 0
function k(t, e) {
  return ((W = t), (F = t.exports), (P = e), (l = null), (m = null), (h = null), F)
}
function E(e) {
  if (void 0 !== F) return F
  void 0 !== e &&
    (Object.getPrototypeOf(e) === Object.prototype
      ? ({ module: e } = e)
      : console.warn('using deprecated parameters for `initSync()`; pass a single object instead'))
  const n = t()
  return (
    e instanceof WebAssembly.Module || (e = new WebAssembly.Module(e)),
    k(new WebAssembly.Instance(e, n), e)
  )
}
async function M(e) {
  if (void 0 !== F) return F
  ;(void 0 !== e &&
    (Object.getPrototypeOf(e) === Object.prototype
      ? ({ module_or_path: e } = e)
      : console.warn(
          'using deprecated parameters for the initialization function; pass a single object instead'
        )),
    void 0 === e && (e = new URL('luiskr_text_draw_bg.wasm', import.meta.url)))
  const n = t()
  ;('string' == typeof e ||
    ('function' == typeof Request && e instanceof Request) ||
    ('function' == typeof URL && e instanceof URL)) &&
    (e = fetch(e))
  const { instance: r, module: _ } = await (async function (t, e) {
    if ('function' == typeof Response && t instanceof Response) {
      if (!t.ok)
        throw new Error(`failed to fetch Wasm: ${t.status} ${t.statusText} fetching '${t.url}'`)
      if ('function' == typeof WebAssembly.instantiateStreaming)
        try {
          return await WebAssembly.instantiateStreaming(t, e)
        } catch (e) {
          if (
            !(function (t) {
              switch (t) {
                case 'basic':
                case 'cors':
                case 'default':
                  return !0
              }
              return !1
            })(t.type) ||
            'application/wasm' === t.headers.get('Content-Type')
          )
            throw e
          console.warn(
            '`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
            e
          )
        }
      const n = await t.arrayBuffer()
      return await WebAssembly.instantiate(n, e)
    }
    {
      const n = await WebAssembly.instantiate(t, e)
      return n instanceof WebAssembly.Instance ? { instance: n, module: t } : n
    }
  })(await e, n)
  return k(r, _)
}
export { E as initSync, M as default }

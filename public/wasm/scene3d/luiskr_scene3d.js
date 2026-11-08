/* @ts-self-types="./luiskr_scene3d.d.ts" */
export class Surface3d {
  static __wrap(e) {
    const t = Object.create(Surface3d.prototype)
    return ((t.__wbg_ptr = e), m.register(t, t.__wbg_ptr, t), t)
  }
  __destroy_into_raw() {
    const e = this.__wbg_ptr
    return ((this.__wbg_ptr = 0), m.unregister(this), e)
  }
  free() {
    const e = this.__destroy_into_raw()
    N.__wbg_surface3d_free(e, 0)
  }
  add_group(e) {
    return N.surface3d_add_group(this.__wbg_ptr, e) >>> 0
  }
  add_instanced(e, t, _, n) {
    return N.surface3d_add_instanced(this.__wbg_ptr, e, t, _, n) >>> 0
  }
  add_lod(e) {
    return N.surface3d_add_lod(this.__wbg_ptr, e) >>> 0
  }
  add_material_basic(e, t, _, n, r) {
    return N.surface3d_add_material_basic(this.__wbg_ptr, e, t, _, n, r) >>> 0
  }
  add_material_points(e, t, _, n, r, a) {
    return N.surface3d_add_material_points(this.__wbg_ptr, e, t, _, n, r, a) >>> 0
  }
  add_material_sprite(e, t, _, n, r) {
    return N.surface3d_add_material_sprite(this.__wbg_ptr, e, t, _, n, r) >>> 0
  }
  add_material_standard(e, t, _, n, r, a, o) {
    return N.surface3d_add_material_standard(this.__wbg_ptr, e, t, _, n, r, a, o) >>> 0
  }
  add_mesh(e, t, _) {
    return N.surface3d_add_mesh(this.__wbg_ptr, e, t, _) >>> 0
  }
  add_points(e, t, _) {
    return N.surface3d_add_points(this.__wbg_ptr, e, t, _) >>> 0
  }
  add_sprite(e, t) {
    return N.surface3d_add_sprite(this.__wbg_ptr, e, t) >>> 0
  }
  camera_look_at(e, t, _) {
    N.surface3d_camera_look_at(this.__wbg_ptr, e, t, _)
  }
  destroy() {
    const e = this.__destroy_into_raw()
    N.surface3d_destroy(e)
  }
  frame(e, t) {
    N.surface3d_frame(this.__wbg_ptr, e, t)
  }
  gen_box(e, t, _, n) {
    return N.surface3d_gen_box(this.__wbg_ptr, e, t, _, n) >>> 0
  }
  gen_cylinder(e, t, _, n, r) {
    return N.surface3d_gen_cylinder(this.__wbg_ptr, e, t, _, n, r) >>> 0
  }
  gen_icosahedron(e, t, _) {
    return N.surface3d_gen_icosahedron(this.__wbg_ptr, e, t, _) >>> 0
  }
  gen_plane(e, t, _) {
    return N.surface3d_gen_plane(this.__wbg_ptr, e, t, _) >>> 0
  }
  gen_ring(e, t, _, n) {
    return N.surface3d_gen_ring(this.__wbg_ptr, e, t, _, n) >>> 0
  }
  gen_sphere(e, t, _, n) {
    return N.surface3d_gen_sphere(this.__wbg_ptr, e, t, _, n) >>> 0
  }
  gen_tetrahedron(e, t) {
    return N.surface3d_gen_tetrahedron(this.__wbg_ptr, e, t) >>> 0
  }
  gen_torus(e, t, _, n, r) {
    return N.surface3d_gen_torus(this.__wbg_ptr, e, t, _, n, r) >>> 0
  }
  node_look_at(e, t, _, n) {
    N.surface3d_node_look_at(this.__wbg_ptr, e, t, _, n)
  }
  ray_at(e, t, _, n) {
    try {
      const s = N.__wbindgen_add_to_stack_pointer(-16)
      N.surface3d_ray_at(s, this.__wbg_ptr, e, t, _, n)
      var r = O().getInt32(s + 0, !0),
        a = O().getInt32(s + 4, !0),
        o = x(r, a).slice()
      return (N.__wbindgen_export4(r, 4 * a, 4), o)
    } finally {
      N.__wbindgen_add_to_stack_pointer(16)
    }
  }
  remove(e) {
    N.surface3d_remove(this.__wbg_ptr, e)
  }
  resize(e, t) {
    N.surface3d_resize(this.__wbg_ptr, e, t)
  }
  set_camera(e, t, _) {
    N.surface3d_set_camera(this.__wbg_ptr, e, t, _)
  }
  set_camera_layers(e) {
    N.surface3d_set_camera_layers(this.__wbg_ptr, e)
  }
  set_clear(e, t, _, n) {
    N.surface3d_set_clear(this.__wbg_ptr, e, t, _, n)
  }
  set_clip(e, t) {
    N.surface3d_set_clip(this.__wbg_ptr, e, t)
  }
  set_color(e, t, _, n, r) {
    N.surface3d_set_color(this.__wbg_ptr, e, t, _, n, r)
  }
  set_emissive(e, t, _, n, r) {
    N.surface3d_set_emissive(this.__wbg_ptr, e, t, _, n, r)
  }
  set_euler(e, t, _, n) {
    N.surface3d_set_euler(this.__wbg_ptr, e, t, _, n)
  }
  set_fov(e) {
    N.surface3d_set_fov(this.__wbg_ptr, e)
  }
  set_instance(e, t, _) {
    const n = z(_, N.__wbindgen_export),
      r = H
    N.surface3d_set_instance(this.__wbg_ptr, e, t, n, r)
  }
  set_layers(e, t) {
    N.surface3d_set_layers(this.__wbg_ptr, e, t)
  }
  set_light(e, t, _, n, r, a, o) {
    N.surface3d_set_light(this.__wbg_ptr, e, t, _, n, r, a, o)
  }
  set_lod_range(e, t, _) {
    N.surface3d_set_lod_range(this.__wbg_ptr, e, t, _)
  }
  set_material_flags(e, t, _, n, r) {
    N.surface3d_set_material_flags(this.__wbg_ptr, e, t, _, n, r)
  }
  set_orbit(e, t, _, n, r, a) {
    N.surface3d_set_orbit(this.__wbg_ptr, e, t, _, n, r, a)
  }
  set_position(e, t, _, n) {
    N.surface3d_set_position(this.__wbg_ptr, e, t, _, n)
  }
  set_post(e, t, _) {
    N.surface3d_set_post(this.__wbg_ptr, e, t, _)
  }
  set_render_order(e, t) {
    N.surface3d_set_render_order(this.__wbg_ptr, e, t)
  }
  set_scale(e, t, _, n) {
    N.surface3d_set_scale(this.__wbg_ptr, e, t, _, n)
  }
  set_size(e, t) {
    N.surface3d_set_size(this.__wbg_ptr, e, t)
  }
  set_user_data(e, t) {
    N.surface3d_set_user_data(this.__wbg_ptr, e, t)
  }
  set_visible(e, t) {
    N.surface3d_set_visible(this.__wbg_ptr, e, t)
  }
  upload_geometry(e, t, _, n, r) {
    const a = z(e, N.__wbindgen_export),
      o = H,
      s = z(t, N.__wbindgen_export),
      c = H,
      i = z(_, N.__wbindgen_export),
      u = H,
      f = (function (e) {
        const t = (0, N.__wbindgen_export)(4 * e.length, 4) >>> 0
        return (
          ((null !== L && 0 !== L.byteLength) || (L = new Uint32Array(N.memory.buffer)), L).set(
            e,
            t / 4
          ),
          (H = e.length),
          t
        )
      })(n),
      b = H
    return N.surface3d_upload_geometry(this.__wbg_ptr, a, o, s, c, i, u, f, b, r) >>> 0
  }
  upload_texture(e, t, _) {
    try {
      return (
        N.surface3d_upload_texture(
          this.__wbg_ptr,
          (function (e) {
            if (1 == C) throw new Error('out of js stack')
            return ((W[--C] = e), C)
          })(e),
          t,
          _
        ) >>> 0
      )
    } finally {
      W[C++] = void 0
    }
  }
  user_data(e) {
    return N.surface3d_user_data(this.__wbg_ptr, e)
  }
  world_position(e) {
    try {
      const r = N.__wbindgen_add_to_stack_pointer(-16)
      N.surface3d_world_position(r, this.__wbg_ptr, e)
      var t = O().getInt32(r + 0, !0),
        _ = O().getInt32(r + 4, !0),
        n = x(t, _).slice()
      return (N.__wbindgen_export4(t, 4 * _, 4), n)
    } finally {
      N.__wbindgen_add_to_stack_pointer(16)
    }
  }
}
Symbol.dispose && (Surface3d.prototype[Symbol.dispose] = Surface3d.prototype.free)
export function mount(e, t, _, n) {
  try {
    const o = N.__wbindgen_add_to_stack_pointer(-16)
    N.mount(o, h(e), h(t), _, n)
    var r = O().getInt32(o + 0, !0),
      a = O().getInt32(o + 4, !0)
    if (O().getInt32(o + 8, !0)) throw E(a)
    return Surface3d.__wrap(r)
  } finally {
    N.__wbindgen_add_to_stack_pointer(16)
  }
}
function e() {
  const e = {
    __proto__: null,
    __wbg___wbindgen_debug_string_4687d8d8c2017d52: function (e, t) {
      const _ = (function (e, t, _) {
          if (void 0 === _) {
            const _ = V.encode(e),
              n = t(_.length, 1) >>> 0
            return (
              j()
                .subarray(n, n + _.length)
                .set(_),
              (H = _.length),
              n
            )
          }
          let n = e.length,
            r = t(n, 1) >>> 0
          const a = j()
          let o = 0
          for (; o < n; o++) {
            const t = e.charCodeAt(o)
            if (t > 127) break
            a[r + o] = t
          }
          if (o !== n) {
            ;(0 !== o && (e = e.slice(o)), (r = _(r, n, (n = o + 3 * e.length), 1) >>> 0))
            const t = j().subarray(r + o, r + n)
            ;((o += V.encodeInto(e, t).written), (r = _(r, n, o, 1) >>> 0))
          }
          return ((H = o), r)
        })(y(P(t)), N.__wbindgen_export, N.__wbindgen_export2),
        n = H
      ;(O().setInt32(e + 4, n, !0), O().setInt32(e + 0, _, !0))
    },
    __wbg___wbindgen_is_null_e343b7d08827ba72: function (e) {
      return null === P(e)
    },
    __wbg___wbindgen_is_undefined_8865fb403f8fe9d8: function (e) {
      return void 0 === P(e)
    },
    __wbg___wbindgen_throw_41e9ee4f547fc59a: function (e, t) {
      throw new Error(k(e, t))
    },
    __wbg_beginRenderPass_46bc75d13eaf7381: function () {
      return R(function (e, t) {
        return h(P(e).beginRenderPass(P(t)))
      }, arguments)
    },
    __wbg_configure_a4e26031ba2da6a2: function () {
      return R(function (e, t) {
        P(e).configure(P(t))
      }, arguments)
    },
    __wbg_copyExternalImageToTexture_91a2b84d7d19190c: function () {
      return R(function (e, t, _, n) {
        P(e).copyExternalImageToTexture(P(t), P(_), P(n))
      }, arguments)
    },
    __wbg_createBindGroupLayout_dd6a685e68699be9: function () {
      return R(function (e, t) {
        return h(P(e).createBindGroupLayout(P(t)))
      }, arguments)
    },
    __wbg_createBindGroup_297f726263493b7a: function (e, t) {
      return h(P(e).createBindGroup(P(t)))
    },
    __wbg_createBuffer_7d58b37b7042f31f: function () {
      return R(function (e, t) {
        return h(P(e).createBuffer(P(t)))
      }, arguments)
    },
    __wbg_createCommandEncoder_d26cb1fdb68219f7: function (e, t) {
      return h(P(e).createCommandEncoder(P(t)))
    },
    __wbg_createPipelineLayout_39a9a7f694e28389: function (e, t) {
      return h(P(e).createPipelineLayout(P(t)))
    },
    __wbg_createRenderPipeline_e7c57f75917917e4: function () {
      return R(function (e, t) {
        return h(P(e).createRenderPipeline(P(t)))
      }, arguments)
    },
    __wbg_createSampler_1271407d57de5444: function (e, t) {
      return h(P(e).createSampler(P(t)))
    },
    __wbg_createShaderModule_274373c4cacce3a0: function (e, t) {
      return h(P(e).createShaderModule(P(t)))
    },
    __wbg_createTexture_272b1f1151792884: function () {
      return R(function (e, t) {
        return h(P(e).createTexture(P(t)))
      }, arguments)
    },
    __wbg_createView_7520397d720e9d7d: function () {
      return R(function (e) {
        return h(P(e).createView())
      }, arguments)
    },
    __wbg_drawIndexed_b414a9de781296f1: function (e, t) {
      P(e).drawIndexed(t >>> 0)
    },
    __wbg_drawIndexed_e4849324c06361c1: function (e, t, _) {
      P(e).drawIndexed(t >>> 0, _ >>> 0)
    },
    __wbg_end_a97f51ac1f092bfe: function (e) {
      P(e).end()
    },
    __wbg_finish_489db1750712613c: function (e) {
      return h(P(e).finish())
    },
    __wbg_getContext_635e36719cad2623: function () {
      return R(function (e, t, _) {
        const n = P(e).getContext(k(t, _))
        return M(n) ? 0 : h(n)
      }, arguments)
    },
    __wbg_getCurrentTexture_f9b3ddbfb8575837: function () {
      return R(function (e) {
        return h(P(e).getCurrentTexture())
      }, arguments)
    },
    __wbg_getPreferredCanvasFormat_4d28b652aa67cc74: function (e) {
      const t = P(e).getPreferredCanvasFormat()
      return (l.indexOf(t) + 1 || 102) - 1
    },
    __wbg_get_31af05bd4842a84f: function () {
      return R(function (e, t) {
        return h(Reflect.get(P(e), P(t)))
      }, arguments)
    },
    __wbg_new_617a8cdb8bb1130e: function () {
      return h(new Object())
    },
    __wbg_queue_17ba8833afbd540b: function (e) {
      return h(P(e).queue)
    },
    __wbg_setBindGroup_4af09961dd6fd6d4: function (e, t, _) {
      P(e).setBindGroup(t >>> 0, P(_))
    },
    __wbg_setIndexBuffer_d9fac7388da9021a: function (e, t, _) {
      P(e).setIndexBuffer(P(t), u[_])
    },
    __wbg_setPipeline_9870f87d9e0a49ab: function (e, t) {
      P(e).setPipeline(P(t))
    },
    __wbg_setVertexBuffer_7e35a3ca5e6c4878: function (e, t, _) {
      P(e).setVertexBuffer(t >>> 0, P(_))
    },
    __wbg_set_a_d2dae9a62946ba86: function (e, t) {
      P(e).a = t
    },
    __wbg_set_address_mode_u_38bbe83e7cb70867: function (e, _) {
      P(e).addressModeU = t[_]
    },
    __wbg_set_address_mode_v_e4dc81ae95d4e2d1: function (e, _) {
      P(e).addressModeV = t[_]
    },
    __wbg_set_alpha_b14827cf8b4ac26a: function (e, t) {
      P(e).alpha = P(t)
    },
    __wbg_set_alpha_mode_16c3966c224ad4a9: function (e, t) {
      P(e).alphaMode = a[t]
    },
    __wbg_set_array_stride_c30294b65e05ecbf: function (e, t) {
      P(e).arrayStride = t >>> 0
    },
    __wbg_set_attributes_9f3751b5d4cb6fbf: function (e, t, _) {
      P(e).attributes = v(t, _)
    },
    __wbg_set_b_670dfc0631dcb9c1: function (e, t) {
      P(e).b = t
    },
    __wbg_set_bind_group_layouts_60a4869809302d79: function (e, t, _) {
      P(e).bindGroupLayouts = v(t, _)
    },
    __wbg_set_binding_1d51e1a2d1c0cdaf: function (e, t) {
      P(e).binding = t >>> 0
    },
    __wbg_set_binding_348f002e688081ac: function (e, t) {
      P(e).binding = t >>> 0
    },
    __wbg_set_blend_3f83603fc878c51d: function (e, t) {
      P(e).blend = P(t)
    },
    __wbg_set_buffer_22331adbf81699d2: function (e, t) {
      P(e).buffer = P(t)
    },
    __wbg_set_buffer_b8d40a54af365605: function (e, t) {
      P(e).buffer = P(t)
    },
    __wbg_set_buffers_c1346a3c65c0829a: function (e, t, _) {
      P(e).buffers = v(t, _)
    },
    __wbg_set_bytes_per_row_95041361899e65c1: function (e, t) {
      P(e).bytesPerRow = t >>> 0
    },
    __wbg_set_clear_value_gpu_color_dict_c17321221601e286: function (e, t) {
      P(e).clearValue = P(t)
    },
    __wbg_set_code_4510e93549b3066e: function (e, t, _) {
      P(e).code = k(t, _)
    },
    __wbg_set_color_14d2fdcfc7117305: function (e, t) {
      P(e).color = P(t)
    },
    __wbg_set_color_attachments_367a5baf85bca057: function (e, t, _) {
      P(e).colorAttachments = v(t, _)
    },
    __wbg_set_cull_mode_7a9f5499205a7f66: function (e, t) {
      P(e).cullMode = s[t]
    },
    __wbg_set_depth_clear_value_5063e6b8ebc5e409: function (e, t) {
      P(e).depthClearValue = t
    },
    __wbg_set_depth_compare_6bbd783f803d2663: function (e, t) {
      P(e).depthCompare = o[t]
    },
    __wbg_set_depth_load_op_a1b09a7ef6e4c3d4: function (e, t) {
      P(e).depthLoadOp = f[t]
    },
    __wbg_set_depth_stencil_attachment_d17d58f9212bc033: function (e, t) {
      P(e).depthStencilAttachment = P(t)
    },
    __wbg_set_depth_stencil_feb50d4de7e35eb1: function (e, t) {
      P(e).depthStencil = P(t)
    },
    __wbg_set_depth_store_op_da4447aff70c723d: function (e, t) {
      P(e).depthStoreOp = g[t]
    },
    __wbg_set_depth_write_enabled_88916d207b076ce9: function (e, t) {
      P(e).depthWriteEnabled = 0 !== t
    },
    __wbg_set_device_53f6c9076263d322: function (e, t) {
      P(e).device = P(t)
    },
    __wbg_set_dst_factor_cfb1cd4ae3e673d9: function (e, t) {
      P(e).dstFactor = _[t]
    },
    __wbg_set_entries_7c51a3643c761ecf: function (e, t, _) {
      P(e).entries = v(t, _)
    },
    __wbg_set_entries_cc80db0de96ea4ff: function (e, t, _) {
      P(e).entries = v(t, _)
    },
    __wbg_set_entry_point_a7593f073d0352f7: function (e, t, _) {
      P(e).entryPoint = k(t, _)
    },
    __wbg_set_entry_point_edfb9dd004493bc8: function (e, t, _) {
      P(e).entryPoint = k(t, _)
    },
    __wbg_set_format_036434fd3db220e7: function (e, t) {
      P(e).format = l[t]
    },
    __wbg_set_format_67f2d982476ea95a: function (e, t) {
      P(e).format = l[t]
    },
    __wbg_set_format_6bbbd4df6747733e: function (e, t) {
      P(e).format = l[t]
    },
    __wbg_set_format_d1ce90a1fc3dd2cc: function (e, t) {
      P(e).format = w[t]
    },
    __wbg_set_format_d4c8ef73b087dab0: function (e, t) {
      P(e).format = l[t]
    },
    __wbg_set_fragment_9bc5cc98c7c59fef: function (e, t) {
      P(e).fragment = P(t)
    },
    __wbg_set_front_face_8f4065ccd6ca4a56: function (e, t) {
      P(e).frontFace = i[t]
    },
    __wbg_set_g_ac69babc4a0b2338: function (e, t) {
      P(e).g = t
    },
    __wbg_set_has_dynamic_offset_e2a0bd85eaf36f34: function (e, t) {
      P(e).hasDynamicOffset = 0 !== t
    },
    __wbg_set_height_3879aafd24f118f9: function (e, t) {
      P(e).height = t >>> 0
    },
    __wbg_set_layout_4e86f7c1671a06d0: function (e, t) {
      P(e).layout = P(t)
    },
    __wbg_set_layout_f2b50454b73e9111: function (e, t) {
      P(e).layout = P(t)
    },
    __wbg_set_load_op_18ff54287ff40151: function (e, t) {
      P(e).loadOp = f[t]
    },
    __wbg_set_mag_filter_91c348b29e1a6e57: function (e, t) {
      P(e).magFilter = c[t]
    },
    __wbg_set_min_filter_fdbe96994784b13c: function (e, t) {
      P(e).minFilter = c[t]
    },
    __wbg_set_module_168054323d22d57d: function (e, t) {
      P(e).module = P(t)
    },
    __wbg_set_module_1ad4e7343951303d: function (e, t) {
      P(e).module = P(t)
    },
    __wbg_set_offset_618dd5b4444a70c9: function (e, t) {
      P(e).offset = t >>> 0
    },
    __wbg_set_operation_d8894b0f9aa3db27: function (e, t) {
      P(e).operation = n[t]
    },
    __wbg_set_primitive_3b6c52880715b903: function (e, t) {
      P(e).primitive = P(t)
    },
    __wbg_set_r_ccf9fe3e4d993555: function (e, t) {
      P(e).r = t
    },
    __wbg_set_resource_3367d3d5c5114a05: function (e, t) {
      P(e).resource = P(t)
    },
    __wbg_set_resource_gpu_buffer_binding_c689b0dc9379a99b: function (e, t) {
      P(e).resource = P(t)
    },
    __wbg_set_resource_gpu_texture_view_2ed0c241a5831597: function (e, t) {
      P(e).resource = P(t)
    },
    __wbg_set_rows_per_image_97b4a26f53457ed3: function (e, t) {
      P(e).rowsPerImage = t >>> 0
    },
    __wbg_set_sampler_e7e837391d5b7c70: function (e, t) {
      P(e).sampler = P(t)
    },
    __wbg_set_shader_location_c7d2a36952c56851: function (e, t) {
      P(e).shaderLocation = t >>> 0
    },
    __wbg_set_size_4716cf40ee7a64be: function (e, t) {
      P(e).size = t >>> 0
    },
    __wbg_set_size_c2eb75980b76e0ac: function (e, t, _) {
      P(e).size = v(t, _)
    },
    __wbg_set_source_3ffc7e2ebf9b8967: function (e, t) {
      P(e).source = P(t)
    },
    __wbg_set_src_factor_b29ea819b1b5d6f6: function (e, t) {
      P(e).srcFactor = _[t]
    },
    __wbg_set_step_mode_0877ef5a4eae6e5b: function (e, t) {
      P(e).stepMode = p[t]
    },
    __wbg_set_store_op_6d2fb6cc3e66341e: function (e, t) {
      P(e).storeOp = g[t]
    },
    __wbg_set_targets_0328c60fcfc0f564: function (e, t, _) {
      P(e).targets = v(t, _)
    },
    __wbg_set_texture_5e4b2303dfbef0fa: function (e, t) {
      P(e).texture = P(t)
    },
    __wbg_set_texture_9f67e0e92f7c2af3: function (e, t) {
      P(e).texture = P(t)
    },
    __wbg_set_texture_e6c25e637d8a26a4: function (e, t) {
      P(e).texture = P(t)
    },
    __wbg_set_topology_36f1b64a3f922a23: function (e, t) {
      P(e).topology = b[t]
    },
    __wbg_set_type_8e9e3a274f528f3e: function (e, t) {
      P(e).type = d[t]
    },
    __wbg_set_type_ff9e8f3110ad0cbf: function (e, t) {
      P(e).type = r[t]
    },
    __wbg_set_usage_7177d2b5a0cb7ed1: function (e, t) {
      P(e).usage = t >>> 0
    },
    __wbg_set_usage_aad5221dc614bcd1: function (e, t) {
      P(e).usage = t >>> 0
    },
    __wbg_set_usage_e842e619c53799e7: function (e, t) {
      P(e).usage = t >>> 0
    },
    __wbg_set_vertex_5b13839ffaff5f37: function (e, t) {
      P(e).vertex = P(t)
    },
    __wbg_set_view_gpu_texture_view_8d8dd7c0c832a505: function (e, t) {
      P(e).view = P(t)
    },
    __wbg_set_view_gpu_texture_view_9f7613e516713508: function (e, t) {
      P(e).view = P(t)
    },
    __wbg_set_visibility_78cfb96740c9deb5: function (e, t) {
      P(e).visibility = t >>> 0
    },
    __wbg_set_width_4aa921b5f44a4f8b: function (e, t) {
      P(e).width = t >>> 0
    },
    __wbg_static_accessor_GLOBAL_266715b9d96ba635: function () {
      const e = 'undefined' == typeof global ? null : global
      return M(e) ? 0 : h(e)
    },
    __wbg_static_accessor_GLOBAL_THIS_10fb7dc1ae063179: function () {
      const e = 'undefined' == typeof globalThis ? null : globalThis
      return M(e) ? 0 : h(e)
    },
    __wbg_static_accessor_SELF_0b583911f537483a: function () {
      const e = 'undefined' == typeof self ? null : self
      return M(e) ? 0 : h(e)
    },
    __wbg_static_accessor_WINDOW_d7f903d1508cbdc4: function () {
      const e = 'undefined' == typeof window ? null : window
      return M(e) ? 0 : h(e)
    },
    __wbg_submit_46ecaa46ea244579: function (e, t, _) {
      P(e).submit(v(t, _))
    },
    __wbg_writeBuffer_2c02702ce0fa25c3: function () {
      return R(function (e, t, _, n, r) {
        P(e).writeBuffer(P(t), _ >>> 0, I(n, r))
      }, arguments)
    },
    __wbg_writeTexture_1fef8db24ba11cf3: function () {
      return R(function (e, t, _, n, r, a) {
        P(e).writeTexture(P(t), I(_, n), P(r), P(a))
      }, arguments)
    },
    __wbindgen_generic_0000000000000001: function (e) {
      return h(e)
    },
    __wbindgen_generic_0000000000000002: function (e, t) {
      return h(k(e, t))
    },
    __wbindgen_object_clone_ref: function (e) {
      return h(P(e))
    },
    __wbindgen_object_drop_ref: function (e) {
      E(e)
    },
  }
  return { __proto__: null, './luiskr_scene3d_bg.js': e }
}
const t = ['clamp-to-edge', 'repeat', 'mirror-repeat'],
  _ = [
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
  n = ['add', 'subtract', 'reverse-subtract', 'min', 'max'],
  r = ['uniform', 'storage', 'read-only-storage'],
  a = ['opaque', 'premultiplied'],
  o = ['never', 'less', 'equal', 'less-equal', 'greater', 'not-equal', 'greater-equal', 'always'],
  s = ['none', 'front', 'back'],
  c = ['nearest', 'linear'],
  i = ['ccw', 'cw'],
  u = ['uint16', 'uint32'],
  f = ['load', 'clear'],
  b = ['point-list', 'line-list', 'line-strip', 'triangle-list', 'triangle-strip'],
  d = ['filtering', 'non-filtering', 'comparison'],
  g = ['store', 'discard'],
  l = [
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
  w = [
    'uint8',
    'uint8x2',
    'uint8x4',
    'sint8',
    'sint8x2',
    'sint8x4',
    'unorm8',
    'unorm8x2',
    'unorm8x4',
    'snorm8',
    'snorm8x2',
    'snorm8x4',
    'uint16',
    'uint16x2',
    'uint16x4',
    'sint16',
    'sint16x2',
    'sint16x4',
    'unorm16',
    'unorm16x2',
    'unorm16x4',
    'snorm16',
    'snorm16x2',
    'snorm16x4',
    'float16',
    'float16x2',
    'float16x4',
    'float32',
    'float32x2',
    'float32x3',
    'float32x4',
    'uint32',
    'uint32x2',
    'uint32x3',
    'uint32x4',
    'sint32',
    'sint32x2',
    'sint32x3',
    'sint32x4',
    'unorm10-10-10-2',
    'unorm8x4-bgra',
  ],
  p = ['vertex', 'instance'],
  m =
    'undefined' == typeof FinalizationRegistry
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry((e) => N.__wbg_surface3d_free(e, 1))
function h(e) {
  F === W.length && W.push(W.length + 1)
  const t = F
  return ((F = W[t]), (W[t] = e), t)
}
function y(e) {
  const t = typeof e
  if ('number' == t || 'boolean' == t || null == e) return `${e}`
  if ('string' == t) return `"${e}"`
  if ('symbol' == t) {
    const t = e.description
    return null == t ? 'Symbol' : `Symbol(${t})`
  }
  if ('function' == t) {
    const t = e.name
    return 'string' == typeof t && t.length > 0 ? `Function(${t})` : 'Function'
  }
  if (Array.isArray(e)) {
    const t = e.length
    let _ = '['
    t > 0 && (_ += y(e[0]))
    for (let n = 1; n < t; n++) _ += ', ' + y(e[n])
    return ((_ += ']'), _)
  }
  const _ = /\[object ([^\]]+)\]/.exec(toString.call(e))
  let n
  if (!(_ && _.length > 1)) return toString.call(e)
  if (((n = _[1]), 'Object' == n))
    try {
      return 'Object(' + JSON.stringify(e) + ')'
    } catch (e) {
      return 'Object'
    }
  return e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : n
}
function x(e, t) {
  return ((e >>>= 0), B().subarray(e / 4, e / 4 + t))
}
function v(e, t) {
  e >>>= 0
  const _ = O(),
    n = []
  for (let r = e; r < e + 4 * t; r += 4) n.push(P(_.getUint32(r, !0)))
  return n
}
function I(e, t) {
  return ((e >>>= 0), j().subarray(e / 1, e / 1 + t))
}
let S = null
function O() {
  return (
    (null === S ||
      !0 === S.buffer.detached ||
      (void 0 === S.buffer.detached && S.buffer !== N.memory.buffer)) &&
      (S = new DataView(N.memory.buffer)),
    S
  )
}
let A = null
function B() {
  return ((null !== A && 0 !== A.byteLength) || (A = new Float32Array(N.memory.buffer)), A)
}
function k(e, t) {
  return (function (e, t) {
    return (
      (G += t),
      G >= q && (($ = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })), $.decode(), (G = t)),
      $.decode(j().subarray(e, e + t))
    )
  })(e >>> 0, t)
}
let L = null,
  T = null
function j() {
  return ((null !== T && 0 !== T.byteLength) || (T = new Uint8Array(N.memory.buffer)), T)
}
function P(e) {
  return W[e]
}
function R(e, t) {
  try {
    return e.apply(this, t)
  } catch (e) {
    N.__wbindgen_export3(h(e))
  }
}
let W = new Array(1024).fill(void 0)
W.push(void 0, null, !0, !1)
let F = W.length
function M(e) {
  return null == e
}
function z(e, t) {
  const _ = t(4 * e.length, 4) >>> 0
  return (B().set(e, _ / 4), (H = e.length), _)
}
let C = 1024
function E(e) {
  const t = P(e)
  return (
    (function (e) {
      e < 1028 || ((W[e] = F), (F = e))
    })(e),
    t
  )
}
let $ = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })
$.decode()
const q = 2146435072
let G = 0
const V = new TextEncoder()
'encodeInto' in V ||
  (V.encodeInto = function (e, t) {
    const _ = V.encode(e)
    return (t.set(_), { read: e.length, written: _.length })
  })
let U,
  D,
  N,
  H = 0
function J(e, t) {
  return ((D = e), (N = e.exports), (U = t), (S = null), (A = null), (L = null), (T = null), N)
}
function K(t) {
  if (void 0 !== N) return N
  void 0 !== t &&
    (Object.getPrototypeOf(t) === Object.prototype
      ? ({ module: t } = t)
      : console.warn('using deprecated parameters for `initSync()`; pass a single object instead'))
  const _ = e()
  return (
    t instanceof WebAssembly.Module || (t = new WebAssembly.Module(t)),
    J(new WebAssembly.Instance(t, _), t)
  )
}
async function Q(t) {
  if (void 0 !== N) return N
  ;(void 0 !== t &&
    (Object.getPrototypeOf(t) === Object.prototype
      ? ({ module_or_path: t } = t)
      : console.warn(
          'using deprecated parameters for the initialization function; pass a single object instead'
        )),
    void 0 === t && (t = new URL('luiskr_scene3d_bg.wasm', import.meta.url)))
  const _ = e()
  ;('string' == typeof t ||
    ('function' == typeof Request && t instanceof Request) ||
    ('function' == typeof URL && t instanceof URL)) &&
    (t = fetch(t))
  const { instance: n, module: r } = await (async function (e, t) {
    if ('function' == typeof Response && e instanceof Response) {
      if (!e.ok)
        throw new Error(`failed to fetch Wasm: ${e.status} ${e.statusText} fetching '${e.url}'`)
      if ('function' == typeof WebAssembly.instantiateStreaming)
        try {
          return await WebAssembly.instantiateStreaming(e, t)
        } catch (t) {
          if (
            !(function (e) {
              switch (e) {
                case 'basic':
                case 'cors':
                case 'default':
                  return !0
              }
              return !1
            })(e.type) ||
            'application/wasm' === e.headers.get('Content-Type')
          )
            throw t
          console.warn(
            '`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
            t
          )
        }
      const _ = await e.arrayBuffer()
      return await WebAssembly.instantiate(_, t)
    }
    {
      const _ = await WebAssembly.instantiate(e, t)
      return _ instanceof WebAssembly.Instance ? { instance: _, module: e } : _
    }
  })(await t, _)
  return J(n, r)
}
export { K as initSync, Q as default }

class MypageController < ApplicationController
  before_action :authenticate_user!

  def show
  end

  def pins
    pins = current_user.pins
              .order(created_at: :desc)
              .limit(100)
    render json: pins.map { |pin|
      {
        id: pin.id,
        name: pin.name,
        address: pin.address,
        google_place_id: pin.google_place_id,
        posts_count: pin.posts.size
      }
    }
  end

  def posts
    posts = current_user.posts
                .includes(media_attachments: :blob)
                .order(created_at: :desc)
                .limit(100)

    render json: posts.map { |p|
      {
        id: p.id,
        title: p.title.to_s,
        body:p.body.to_s,
        media: p.media.map { |att|
          ct = att.content_type.to_s
          if ct.start_with?("video/")
            { type: "video", url: url_for(att),
              poster: (att.previewable? ? url_for(att.preview(resize_to_limit: [640, 360]).processed) : nil) }
          else
            { type: "image", url: url_for(att) }
          end
        },
        tags: []
      }
    }
  end
end